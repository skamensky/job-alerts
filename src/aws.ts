import {
  Env,
  SendEmailArgs,
  JobPostData,
  NewJobPostHandler,
  StateStorage,
  State,
} from "./types";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  NoSuchKey,
} from "@aws-sdk/client-s3";
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  SendMessageResult,
  DeleteMessageBatchCommand,
} from "@aws-sdk/client-sqs";

const env = process.env as unknown as Env;

const getSqsUrl = () => {
  return `https://sqs.${env.AWS_REGION}.amazonaws.com/${env.AWS_ACCOUNT_ID}/${env.AWS_SQS_QUEUE_NAME}`;
};

const CREDENTIALS = {
  accessKeyId: env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
};
const sesClient = new SESClient({
  credentials: CREDENTIALS,
  region: env.AWS_REGION,
  apiVersion: "2010-12-01",
});

const sqsClient = new SQSClient({
  credentials: CREDENTIALS,
  region: env.AWS_REGION,
});

const s3Client = new S3Client({
  credentials: CREDENTIALS,
  region: env.AWS_REGION,
});

export const sendEmail = async (args: SendEmailArgs): Promise<void> => {
  const params = {
    Destination: {
      ToAddresses: [args.to],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: args.body,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: args.subject,
      },
    },
    Source: args.from,
  };

  await sesClient.send(new SendEmailCommand(params), (err, data) => {
    if (err) {
      throw new Error(`unable to send email. Original error: ${err.message}`);
    }
  });
};

export const addJobPostToQueue = async (
  jobPost: JobPostData
): Promise<SendMessageResult> => {
  const sqsMessage = {
    QueueUrl: getSqsUrl(),
    MessageBody: JSON.stringify(jobPost),
  };

  return await sqsClient.send(new SendMessageCommand(sqsMessage));
};

const deleteSQSMessages = async (messageIds: string[]) => {
  const entries = messageIds.map((id, index) => ({
    Id: index.toString(),
    ReceiptHandle: id,
  }));

  const deleteParams = {
    QueueUrl: getSqsUrl(),
    Entries: entries,
  };

  return await sqsClient.send(new DeleteMessageBatchCommand(deleteParams));
};

export const processQueueMessages = async (handler: NewJobPostHandler) => {
  while (true) {
    const receiveParams = {
      QueueUrl: getSqsUrl(),
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 5,
    };

    const messages = await sqsClient.send(
      new ReceiveMessageCommand(receiveParams)
    );

    const errors: Error[] = [];
    const messagesToDelete: string[] = [];

    if (messages && messages.Messages) {
      for (const message of messages.Messages) {
        let jobPost: JobPostData;
        if (message.ReceiptHandle) {
          messagesToDelete.push(message.ReceiptHandle);
        } else {
          errors.push(
            Error(`SQS message missing receipt handle, id=${message.MessageId}`)
          );
          continue;
        }
        if (!message.Body) {
          errors.push(
            Error(`SQS message body is empty, id=${message.MessageId}`)
          );
          continue;
        }
        try {
          jobPost = JSON.parse(message.Body);
        } catch (e) {
          errors.push(
            Error(`SQS message body is not valid JSON, id=${message.MessageId}`)
          );
          continue;
        }
        if (!jobPost.body) {
          errors.push(
            Error(
              `SQS message body is missing body property, id=${message.MessageId}`
            )
          );
          continue;
        }

        // happy path:
        try {
          await handler(jobPost);
          console.log(
            `Successfully handled job post with message id ${message.MessageId}`
          );
        } catch (e) {
          // check if e is type Error:
          let errorMessage = "Unable to determine original error message";
          if (e instanceof Error) {
            errorMessage = e.message;
          }
          errors.push(new Error(`Error handling job post: ${errorMessage}`));
        }
      }
    }
    if (messagesToDelete.length > 0) {
      const deleteErrors = await deleteSQSMessages(messagesToDelete);
      if (deleteErrors.Failed) {
        for (const error of deleteErrors.Failed) {
          console.error(`Error deleting SQS message: ${error.Message}`);
        }
      }
    }
  }
};

const writeS3File = async (bucket: string, key: string, body: string) => {
  const params = {
    Bucket: bucket,
    Key: key,
    Body: body,
  };
  await s3Client.send(new PutObjectCommand(params));
};

const readS3File = async (bucket: string, key: string) => {
  const params = {
    Bucket: bucket,
    Key: key,
  };
  const result = await s3Client.send(new GetObjectCommand(params));
  if (!result.Body) {
    throw new Error("Unable to read file from S3");
  }
  return result.Body.transformToString();
};

export class S3StateStorage implements StateStorage {
  private bucketName: string;
  private key: string;
  constructor({ bucketName, key }: { bucketName: string; key: string }) {
    this.bucketName = bucketName;
    this.key = key;
  }

  async initIfNotExists(): Promise<void> {
    try {
      await readS3File(this.bucketName, this.key);
    } catch (e) {
      if (e instanceof NoSuchKey) {
        const dummyState: State = {
          chatIdToLastMessageTimestampInSeconds: {},
        };
        await writeS3File(
          this.bucketName,
          this.key,
          JSON.stringify(dummyState)
        );
        return;
      }
      throw e;
    }
  }

  async read(): Promise<State> {
    const contents = await readS3File(this.bucketName, this.key);
    return JSON.parse(contents) as State;
  }
  async write(state: State): Promise<void> {
    await writeS3File(this.bucketName, this.key, JSON.stringify(state));
  }
}
