import { Client, LocalAuth, Message } from "whatsapp-web.js";
import { StateStorage, JobPostData, Env } from "./types";
import { SendMessageResult } from "@aws-sdk/client-sqs";
const qrcode = require("qrcode-terminal");
export { Message };

let CLIENT: Client;
export const CHATS_TO_SCAN = (process.env as unknown as Env).WHATSAPP_CHATS_TO_SCAN.split(",");
export const formatFromContact = async (msg: Message) => {
  let fromFormatted: string;
  const messageContact = await msg.getContact();
  if (messageContact?.name) {
    fromFormatted = `${messageContact?.name}:(${msg.from})`;
  } else {
    fromFormatted = msg.from;
  }
  return fromFormatted;
};

export function getClient(): Client {
  if (CLIENT) {
    return CLIENT;
  } else {
    // use LegacySessionAuth
    CLIENT = new Client({
      authStrategy: new LocalAuth(),
    });
    CLIENT.on("qr", (qr: string) => {
      // Generate and scan this code with your phone
      console.log("QR RECEIVED. Scan this.");
      qrcode.generate(qr, { small: true });
    });
    return CLIENT;
  }
}

export const catchup = async (
  storage: StateStorage,
  addJobPostToQueue: (jobPost: JobPostData) => Promise<SendMessageResult>
) => {
  const stateRead = await storage.read();
  // using a copy so we don't update the state while iterating
  const stateWrite = Object.assign({}, stateRead);

  const chats = await getClient().getChats();
  for (const chat of chats) {
    if (
      chat.id._serialized in stateRead.chatIdToLastMessageTimestampInSeconds &&
      chat.id._serialized in CHATS_TO_SCAN
    ) {
      const messages = await chat.fetchMessages({ limit: Number.MAX_VALUE });
      for (const message of messages) {
        if (
          message.timestamp >
            stateRead.chatIdToLastMessageTimestampInSeconds[
              chat.id._serialized
            ] &&
          message.body
        ) {
          await addJobPostToQueue({
            body: message.body,
            from: await formatFromContact(message),
            source: `catchup-whatsapp ${chat.id._serialized}`,
          });
          stateWrite.chatIdToLastMessageTimestampInSeconds[
            chat.id._serialized
          ] = message.timestamp;
        }
      }
    }
  }
  await storage.write(stateWrite);
};
