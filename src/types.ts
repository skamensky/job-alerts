export interface Env {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION:string,
  AWS_BUCKET_NAME:string,
  AWS_SQS_QUEUE_NAME:string
  AWS_ACCOUNT_ID:string;

  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  WHATSAPP_CHATS_TO_SCAN: string;
}

export type SendEmailArgs = {
  from: string;
  to: string;
  subject: string;
  body: string;
};

export type GetIsRelavantArgs = {
  skills: string;
  experience: string;
  companyStyle: string;
  careerGoals: string;
  careerNonGoals: string;
  jobPost: JobPostData;
};

export type GetIsRelavantResponse = {
  match: boolean;
  reasons: string[];
  positionTitle: string;
  shortPositionDescription: string;
  company: string;
  originLanguage: string;
  contacts: string[];
  potentialIssues: string[];
  isJobPost: boolean;
};

export type JobPostData = {
  source: string;
  body:string;
  from:string;
};

type SQSJobPostMessage = {
  MessageId: string;
  ReceiptHandle: string;
  Body: string;
};

export type NewJobPostHandler = (
  jobPost: JobPostData
) => Promise<GetIsRelavantResponse>;


export type State = {
  // key is the chat id
  chatIdToLastMessageTimestampInSeconds: { [key: string]: number };
};


export interface StateStorage {
  initIfNotExists: () => Promise<void>;
  read: () => Promise<State>;
  write: (state: State) => Promise<void>;
}