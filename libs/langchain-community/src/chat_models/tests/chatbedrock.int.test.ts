/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { test, expect } from "@jest/globals";
import { HumanMessage } from "@langchain/core/messages";
import { BedrockChat as BedrockChatWeb } from "../bedrock/web.js";
import { BedrockChat } from "../bedrock/index.js";

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
  "Test Bedrock chat model Generating search queries: Command-r",
  "us-east-1",
  "cohere.command-r-v1:0",
  "Who is more popular: Nsync or Backstreet Boys?",
  {
    search_queries_only: true,
  }
);

void testChatModel(
  "Test Bedrock chat model: Command-r",
  "us-east-1",
  "cohere.command-r-v1:0",
  "What is your name?"
);

void testChatModel(
  "Test Bedrock chat model: Command-r",
  "us-east-1",
  "cohere.command-r-v1:0",
  "What are the characteristics of the emperor penguin?",
  {
    documents: [
      { title: "Tall penguins", snippet: "Emperor penguins are the tallest." },
      {
        title: "Penguin habitats",
        snippet: "Emperor penguins only live in Antarctica.",
      },
    ],
  }
);

void testChatStreamingModel(
  "Test Bedrock chat model streaming: Command-r",
  "us-east-1",
  "cohere.command-r-v1:0",
  "What is your name and something about yourself?"
);

void testChatStreamingModel(
  "Test Bedrock chat model streaming: Command-r",
  "us-east-1",
  "cohere.command-r-v1:0",
  "What are the characteristics of the emperor penguin?",
  {
    documents: [
      { title: "Tall penguins", snippet: "Emperor penguins are the tallest." },
      {
        title: "Penguin habitats",
        snippet: "Emperor penguins only live in Antarctica.",
      },
    ],
  }
);

void testChatHandleLLMNewToken(
  "Test Bedrock chat model HandleLLMNewToken: Command-r",
  "us-east-1",
  "cohere.command-r-v1:0",
  "What is your name and something about yourself?"
);

void testChatModel(
  "Test Bedrock chat model: Mistral-7b-instruct",
  "us-east-1",
  "mistral.mistral-7b-instruct-v0:2",
  "What is your name?"
);

void testChatStreamingModel(
  "Test Bedrock chat model streaming: Mistral-7b-instruct",
  "us-east-1",
  "mistral.mistral-7b-instruct-v0:2",
  "What is your name and something about yourself?"
);

void testChatHandleLLMNewToken(
  "Test Bedrock chat model HandleLLMNewToken: Mistral-7b-instruct",
  "us-east-1",
  "mistral.mistral-7b-instruct-v0:2",
  "What is your name and something about yourself?"
);

void testChatModel(
  "Test Bedrock chat model: Claude-3",
  "us-east-1",
  "anthropic.claude-3-sonnet-20240229-v1:0",
  "What is your name?"
);

void testChatStreamingModel(
  "Test Bedrock chat model streaming: Claude-3",
  "us-east-1",
  "anthropic.claude-3-sonnet-20240229-v1:0",
  "What is your name and something about yourself?"
);

void testChatHandleLLMNewToken(
  "Test Bedrock chat model HandleLLMNewToken: Claude-3",
  "us-east-1",
  "anthropic.claude-3-sonnet-20240229-v1:0",
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
  message: string,
  modelKwargs?: Record<string, unknown>
) {
  test(title, async () => {
    const region = process.env.BEDROCK_AWS_REGION ?? defaultRegion;

    const bedrock = new BedrockChatWeb({
      maxTokens: 200,
      region,
      model,
      maxRetries: 0,
      credentials: {
        secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
        accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
        sessionToken: process.env.BEDROCK_AWS_SESSION_TOKEN,
      },
      modelKwargs,
    });

    const res = await bedrock.invoke([new HumanMessage(message)]);
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
  message: string,
  modelKwargs?: Record<string, unknown>
) {
  test(title, async () => {
    const region = process.env.BEDROCK_AWS_REGION ?? defaultRegion;

    const bedrock = new BedrockChatWeb({
      maxTokens: 200,
      region,
      model,
      maxRetries: 0,
      credentials: {
        secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
        accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
        sessionToken: process.env.BEDROCK_AWS_SESSION_TOKEN,
      },
      modelKwargs,
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

    const bedrock = new BedrockChatWeb({
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
          handleLLMEnd(output) {
            console.log(output);
          },
        },
      ],
    });
    const stream = await bedrock.invoke([new HumanMessage(message)]);
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

  const bedrock = new BedrockChatWeb({
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

  const res = await bedrock.invoke([new HumanMessage("What is your name?")]);
  console.log(res);

  expect(res.content.length).toBeGreaterThan(1);
});

test.skip("new credential fields", async () => {
  const model = new BedrockChat({
    filepath: "/Users/bracesproul/code/lang-chain-ai/langchainjs/libs/langchain-community/src/chat_models/tests/aws_credentials",
    model: "anthropic.claude-3-sonnet-20240229-v1:0",
    region: process.env.BEDROCK_AWS_REGION
  })
  const res = await model.invoke(["Why is the sky blue? Be VERY concise!"]);
  console.log("res", res)
})