import { Env } from "./types";
import { readFile } from "fs";
const env = process.env as unknown as Env;
export const getEnv = () => {
  return env;
};

export const readFilePromise = async (fileName: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    readFile(fileName, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.toString());
      }
    });
  });
};

export const validateEnv = (): void => {
  // just here to ensure that the env variables are set
  const dummyEnv: Env = {
    AWS_ACCESS_KEY_ID: "",
    AWS_SECRET_ACCESS_KEY: "",
    AWS_ACCOUNT_ID: "",
    AWS_REGION: "",
    AWS_BUCKET_NAME: "",
    AWS_SQS_QUEUE_NAME: "",

    OPENAI_API_KEY: "",
    OPENAI_MODEL: "",

    WHATSAPP_CHATS_TO_SCAN: "",
  };

  // so we can dynamically check that they are set. Type checking is done above.
  const envAsObject = env as unknown as { [key: string]: string };

  for (const key of Object.keys(dummyEnv)) {
    if (!envAsObject[key]) {
      console.error("Environment variable not set", key);
      process.exit(1);
    }
  }

  if (env.WHATSAPP_CHATS_TO_SCAN.split(",").length === 0) {
    console.error(
      "WHATSAPP_CHATS_TO_SCAN must be a comma separated list of chat ids"
    );
    process.exit(1);
  }
};

export const resolveAfterXSeconds = async (seconds: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, seconds * 1000);
  });
};
