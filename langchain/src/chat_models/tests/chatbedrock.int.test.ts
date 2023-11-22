/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { test, expect } from "@jest/globals";
import { BedrockChat } from "../bedrock/web.js";
import { HumanMessage } from "../../schema/index.js";

// void testChatModel(
//   "Test Bedrock chat model: Llama2 13B v1",
//   "us-east-1",
//   "meta.llama2-13b-chat-v1",
//   "What is your name?"
// );
// void testChatStreamingModel(
//   "Test Bedrock streaming chat model: Llama2 13B v1",
//   "us-east-1",
//   "meta.llama2-13b-chat-v1",
//   "What is your name and something about yourself?"
// );

void testChatModel(
  "Test Bedrock chat model: Claude-v2",
  "us-east-1",
  "anthropic.claude-v2",
  "What is your name?"
);
void testChatStreamingModel(
  "Test Bedrock chat model streaming: Claude-v2",
  "us-east-1",
  "anthropic.claude-v2",
  "What is your name and something about yourself?"
);

void testChatHandleLLMNewToken(
  "Test Bedrock chat model HandleLLMNewToken: Claude-v2",
  "us-east-1",
  "anthropic.claude-v2",
  "What is your name and something about yourself?"
);
// void testChatHandleLLMNewToken(
//   "Test Bedrock chat model HandleLLMNewToken: Llama2 13B v1",
//   "us-east-1",
//   "meta.llama2-13b-chat-v1",
//   "What is your name and something about yourself?"
// );

/**
 * Tests a BedrockChat model
 * @param title The name of the test to run
 * @param defaultRegion The AWS region to default back to if not set via environment
 * @param model The model string to test
 * @param message The prompt test to send to the LLM
 */
async function testChatModel(
  title: string,
  defaultRegion: string,
  model: string,
  message: string
) {
  test(title, async () => {
    const region = process.env.BEDROCK_AWS_REGION ?? defaultRegion;

    const bedrock = new BedrockChat({
      maxTokens: 20,
      region,
      model,
      maxRetries: 0,
      credentials: {
        secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
        accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
        sessionToken: process.env.BEDROCK_AWS_SESSION_TOKEN,
      },
    });

    const res = await bedrock.call([new HumanMessage(message)]);
    console.log(res);
  });
}
/**
 * Tests a BedrockChat model with a streaming response
 * @param title The name of the test to run
 * @param defaultRegion The AWS region to default back to if not set via environment
 * @param model The model string to test
 * @param message The prompt test to send to the LLM
 */
async function testChatStreamingModel(
  title: string,
  defaultRegion: string,
  model: string,
  message: string
) {
  test(title, async () => {
    const region = process.env.BEDROCK_AWS_REGION ?? defaultRegion;

    const bedrock = new BedrockChat({
      maxTokens: 200,
      region,
      model,
      maxRetries: 0,
      credentials: {
        secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
        accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
        sessionToken: process.env.BEDROCK_AWS_SESSION_TOKEN,
      },
    });

    const stream = await bedrock.stream([
      new HumanMessage({
        content: message,
      }),
    ]);
    const chunks = [];
    for await (const chunk of stream) {
      console.log(chunk);
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
  });
}
/**
 * Tests a BedrockChat model with a streaming response using a new token callback
 * @param title The name of the test to run
 * @param defaultRegion The AWS region to default back to if not set via environment
 * @param model The model string to test
 * @param message The prompt test to send to the LLM
 */
async function testChatHandleLLMNewToken(
  title: string,
  defaultRegion: string,
  model: string,
  message: string
) {
  test(title, async () => {
    const region = process.env.BEDROCK_AWS_REGION ?? defaultRegion;
    const tokens: string[] = [];

    const bedrock = new BedrockChat({
      maxTokens: 200,
      region,
      model,
      maxRetries: 0,
      credentials: {
        secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
        accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
        sessionToken: process.env.BEDROCK_AWS_SESSION_TOKEN,
      },
      streaming: true,
      callbacks: [
        {
          handleLLMNewToken: (token) => {
            tokens.push(token);
          },
        },
      ],
    });
    const stream = await bedrock.call([new HumanMessage(message)]);
    expect(tokens.length).toBeGreaterThan(1);
    expect(stream.content).toEqual(tokens.join(""));
  });
}

test.skip.each([
  "amazon.titan-text-express-v1",
  // These models should be supported in the future
  // "amazon.titan-text-lite-v1",
  // "amazon.titan-text-agile-v1",
])("Test Bedrock base chat model: %s", async (model) => {
  const region = process.env.BEDROCK_AWS_REGION ?? "us-east-1";

  const bedrock = new BedrockChat({
    region,
    model,
    maxRetries: 0,
    modelKwargs: {},
    credentials: {
      secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
      accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
      sessionToken: process.env.BEDROCK_AWS_SESSION_TOKEN,
    },
  });

  const res = await bedrock.call([new HumanMessage("What is your name?")]);
  console.log(res);

  expect(res.content.length).toBeGreaterThan(1);
});
