import OpenAI from "openai";
import { getEnv, readFilePromise, resolveAfterXSeconds } from "./utils";
import { encode } from "gpt-tokenizer";
import { GetIsRelavantArgs, GetIsRelavantResponse } from "./types";

const returnSchema = {
  type: "object",
  properties: {
    match: {
      type: "boolean",
    },
    reasons: {
      type: "array",
      items: { type: "string" },
    },
    positionTitle: {
      type: "string",
    },
    shortPositionDescription: {
      type: "string",
    },
    company: {
      type: "string",
    },
    originLanguage: {
      type: "string",
    },
    contacts: {
      type: "array",
      items: { type: "string" },
    },
    potentialIssues: {
      type: "array",
      items: { type: "string" },
    },
    isJobPost: {
      type: "boolean",
    },
  },
  required: [
    "match",
    "reasons",
    "positionTitle",
    "shortPositionDescription",
    "company",
    "originLanguage",
    "contact",
    "potentialIssues",
    "isJobPost",
  ],
};

const client = new OpenAI({
  apiKey: getEnv().OPENAI_API_KEY,
});

// handle rate limiting, values will be set upon first call
let REMAINING_REQUESTS = Number.MAX_VALUE;
let REMAINING_TOKENS = Number.MAX_VALUE;
let RESET_TOKENS_TIME = Date.now() - 1000;
let RESET_REQUESTS_TIME = Date.now() - 1000;

export const getIsRelavant = async (
  args: GetIsRelavantArgs
): Promise<GetIsRelavantResponse> => {
  // todo, add examples into the prompt once we get some feedback
  const promptTemplate = await readFilePromise("assets/prompt.txt");
  const formattedPrompt = promptTemplate
    .replace("{SKILLS}", args.skills)
    .replace("{EXPERIENCE}", args.experience)
    .replace("{COMPANY_STYLE}", args.companyStyle)
    .replace("{CAREER_GOALS}", args.careerGoals)
    .replace("{CAREER_NON_GOALS}", args.careerNonGoals)
    .replace("{JOB_POST}", args.jobPost.body)
    .replace("{JOB_POST_SOURCE}", args.jobPost.source)
    .replace("{JOB_POST_FROM}", args.jobPost.from);

  const promptStringLength = formattedPrompt.length;
  const numTokensNoSchema = encode(formattedPrompt).length;
  const numTokensSchema = encode(
    formattedPrompt + JSON.stringify(returnSchema)
  ).length;

  // console.table({
  //   promptStringLength,
  //   numTokensNoSchema,
  //   numTokensSchema,
  // });

  if (REMAINING_TOKENS !== Number.MAX_VALUE) {
    // this is not the first call, so we need to wait for the next allowed call time
    if (numTokensSchema > REMAINING_TOKENS) {
      await resolveAfterXSeconds(RESET_TOKENS_TIME - Date.now());
    }
    if (REMAINING_REQUESTS <= 0) {
      await resolveAfterXSeconds(RESET_REQUESTS_TIME - Date.now());
    }
  }

  const { data: chatCompletion, response: raw } = await client.chat.completions
    .create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. The ENTIRETY of responses must ALWAYS be valid json the structure of which will be delineated by the prompt.",
        },

        { role: "user", content: formattedPrompt },
      ],
      functions: [{ name: "set_match", parameters: returnSchema }],
      function_call: { name: "set_match" },
      model: getEnv().OPENAI_MODEL,
      temperature: 0,
    })
    .withResponse();

  const remainingRequests = Number(
    raw.headers.get("x-ratelimit-remaining-requests")
  );
  const remainingTokens = Number(
    raw.headers.get("x-ratelimit-remaining-tokens")
  );
  const timeToresetTokens = convertTimeToSeconds(
    raw.headers.get("x-ratelimit-reset-tokens") || ""
  );
  const timeToresetRequests = convertTimeToSeconds(
    raw.headers.get("x-ratelimit-reset-requests") || ""
  );

  // update rate limiting values
  REMAINING_REQUESTS = remainingRequests;
  REMAINING_TOKENS = remainingTokens;
  RESET_TOKENS_TIME = Date.now() + timeToresetTokens * 1000;
  RESET_REQUESTS_TIME = Date.now() + timeToresetRequests * 1000;

  const chatResponse =
    chatCompletion.choices[0]?.message?.function_call?.arguments;
  if (!chatResponse) {
    console.error("Chat response not found", chatCompletion);
    throw new Error("Chat response not found");
  } else {
    return JSON.parse(chatResponse) as GetIsRelavantResponse;
  }
};

// time headers are returned in the format: "x-ratelimit-reset-requests": "1h/1m/1s/1ms" so we need to convert them to seconds
const convertTimeToSeconds = (timeStr: string): number => {
  if (timeStr == "") throw new Error("Invalid time string, string is empty");
  const timeParts = timeStr.match(/(\d+)(ms|h|m|s)/);
  if (!timeParts) {
    throw new Error("Invalid time string");
  }

  const timeValue = parseInt(timeParts[1], 10);
  const timeUnit = timeParts[2];

  switch (timeUnit) {
    case "ms":
      return timeValue / 1000;
    case "h":
      return timeValue * 3600;
    case "m":
      return timeValue * 60;
    case "s":
      return timeValue;
    default:
      throw new Error("Invalid time unit");
  }
};
