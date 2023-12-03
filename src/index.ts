import dotenv from "dotenv";
dotenv.config();
import {
  getClient,
  CHATS_TO_SCAN,
  formatFromContact,
  catchup,
  Message,
} from "./whatsapp";
import { getIsRelavant } from "./gpt";
import {
  sendEmail,
  addJobPostToQueue,
  processQueueMessages,
  S3StateStorage,
} from "./aws";
import { Env, GetIsRelavantResponse, JobPostData } from "./types";
import { validateEnv, readFilePromise } from "./utils";

const env = process.env as unknown as Env;

const stateStorage = new S3StateStorage({
  bucketName: env.AWS_BUCKET_NAME,
  key: "state.json",
});

const getSkills = async (): Promise<string> => {
  return readFilePromise("assets/skills.txt");
};

const getExperience = async (): Promise<string> => {
  return readFilePromise("assets/experience.txt");
};

const getCompanyStyle = async (): Promise<string> => {
  return readFilePromise("assets/companyStyle.txt");
};

const getCareerGoals = async (): Promise<string> => {
  return readFilePromise("assets/careerGoals.txt");
};

const getCareerNonGoals = async (): Promise<string> => {
  return readFilePromise("assets/careerNonGoals.txt");
};

const getToEmail = async (): Promise<string> => {
  return readFilePromise("assets/toEmail.txt");
};

const getEmailTemplate = async (): Promise<string> => {
  return readFilePromise("assets/emailTemplate.txt");
};

// two seconds ago, AWS SES has a limit of 1 email per second in sandbox mode
let LAST_SEND_TIME = Date.now() - 2000;

const sendJobAlertEmail = async (
  answer: GetIsRelavantResponse,
  toEmail: string,
  emailTemplate: string,
  jobPost: JobPostData
) => {
  const subject = `Job Aert: ${answer.positionTitle} - ${answer.company}`;
  const reasonsForMatching = answer.reasons
    .map((reason) => `<li>${reason}</li>`)
    .join("\n");
  const potentialIssues = answer.potentialIssues
    .map((issue) => `<li>${issue}</li>`)
    .join("\n");

  const contacts = answer.contacts
    .map((contact) => `<li>${contact}</li>`)
    .join("\n");
  const fromEmail = toEmail;
  const body = emailTemplate
    .replace("{{SHORT_POSITION_DESCRIPTION}}", answer.shortPositionDescription)
    .replace("{{REASONS}}", reasonsForMatching)
    .replace("{{SOURCE}}", jobPost.body)
    .replace("{{CONTACTS}}", contacts)
    .replace("{{POTENTIAL_ISSUES}}", potentialIssues || "None");
  try {
    //schedule 1 second since last email sent
    const now = Date.now();
    const timeSinceLastEmail = now - LAST_SEND_TIME;
    if (timeSinceLastEmail < 1000) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 - timeSinceLastEmail)
      );
    }
    const sendEmailResult = await sendEmail({
      to: toEmail,
      from: fromEmail,
      subject,
      body,
    });
    LAST_SEND_TIME = Date.now();
    return sendEmailResult;
  } catch (e) {
    throw new Error(
      `unable to send email. Original error: ${(e as Error).message}`
    );
  }
};

const evaluateJobPost = async (
  jobPost: JobPostData
): Promise<GetIsRelavantResponse> => {
  let answer: GetIsRelavantResponse;
  const toEmail = await getToEmail();
  const emailTemplate = await getEmailTemplate();

  try {
    answer = await getIsRelavant({
      skills: await getSkills(),
      experience: await getExperience(),
      companyStyle: await getCompanyStyle(),
      careerGoals: await getCareerGoals(),
      careerNonGoals: await getCareerNonGoals(),
      jobPost,
    });
  } catch (e) {
    throw new Error(
      `unable to check relevancy of message. Original error: ${
        (e as Error).message
      }`
    );
  }
  if (!answer) {
    throw new Error("No answer from GPT");
  }

  if (!answer.isJobPost || !answer.match) {
    // TODO, if it's not a job post, send an email to delete the post since I'm an admin.
    return answer;
  }

  await sendJobAlertEmail(answer, toEmail, emailTemplate, jobPost);
  return answer;
};

getClient().on("ready", async () => {
  console.log("Whatsapp client is ready! Catching up on messages.");
  await stateStorage.initIfNotExists();
  await catchup(stateStorage, addJobPostToQueue);
  console.log("Done catching up on messages. Subscribing to new messages.");
  getClient().on("message_create", newMessageHandler);
});

const newMessageHandler = async (msg: Message) => {
  const chat = await msg.getChat();

  if (CHATS_TO_SCAN.includes(chat.id._serialized) && msg.body) {
    try {
      let fromFormatted = await formatFromContact(msg);
      await addJobPostToQueue({
        body: msg.body,
        from: fromFormatted,
        source: `live-whatsapp ${chat.id._serialized}`,
      });
      const state = await stateStorage.read();
      state.chatIdToLastMessageTimestampInSeconds[chat.id._serialized] =
        msg.timestamp;
      await stateStorage.write(state);
    } catch (e) {
      console.error("Error adding job post to queue", e);
    }
  }
};

validateEnv();
getClient().initialize();
processQueueMessages(evaluateJobPost);
