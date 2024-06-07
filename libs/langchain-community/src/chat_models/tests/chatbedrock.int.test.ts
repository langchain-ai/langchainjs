// libs/langchain-community/src/chat_models/tests/chatbedrock.int.test.ts
/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { test, expect } from "@jest/globals";
import { HumanMessage } from "@langchain/core/messages";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BedrockChat as BedrockChatWeb } from "../bedrock/web.js";
import { TavilySearchResults } from "../../tools/tavily_search.js";

void testChatModel(
  "Test Bedrock chat model Generating search queries: Command-r",
  "us-west-2",
  "cohere.command-r-v1:0",
  "Who is more popular: Nsync or Backstreet Boys?",
  {
    search_queries_only: true,
  }
);

void testChatModel(
  "Test Bedrock chat model: Command-r",
  "us-west-2",
  "cohere.command-r-v1:0",
  "What is your name?",
  {}
);

void testChatModel(
  "Test Bedrock chat model: Command-r",
  "us-west-2",
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
  "us-west-2",
  "cohere.command-r-v1:0",
  "What is your name and something about yourself?",
  {}
);

void testChatStreamingModel(
  "Test Bedrock chat model streaming: Command-r",
  "us-west-2",
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
  "us-west-2",
  "cohere.command-r-v1:0",
  "What is your name and something about yourself?"
);

void testChatModel(
  "Test Bedrock chat model: Mistral-7b-instruct",
  "us-west-2",
  "mistral.mistral-7b-instruct-v0:2",
  "What is your name?",
  {}
);

void testChatStreamingModel(
  "Test Bedrock chat model streaming: Mistral-7b-instruct",
  "us-west-2",
  "mistral.mistral-7b-instruct-v0:2",
  "What is your name and something about yourself?",
  {}
);

void testChatHandleLLMNewToken(
  "Test Bedrock chat model HandleLLMNewToken: Mistral-7b-instruct",
  "us-west-2",
  "mistral.mistral-7b-instruct-v0:2",
  "What is your name and something about yourself?"
);

void testChatModel(
  "Test Bedrock chat model: Claude-3",
  "us-west-2",
  "anthropic.claude-3-sonnet-20240229-v1:0",
  "What is your name?",
  {}
  // "ENABLED",
  // "<your-guardrail-id>",
  // "DRAFT",
  // { tagSuffix: "test", streamProcessingMode: "SYNCHRONOUS" }
);

void testChatStreamingModel(
  "Test Bedrock chat model streaming: Claude-3",
  "us-west-2",
  "anthropic.claude-3-sonnet-20240229-v1:0",
  "What is your name and something about yourself?",
  {}
  // "ENABLED",
  // "<your-guardrail-id>",
  // "DRAFT",
  // { tagSuffix: "test", streamProcessingMode: "SYNCHRONOUS" }
);

void testChatHandleLLMNewToken(
  "Test Bedrock chat model HandleLLMNewToken: Claude-3",
  "us-west-2",
  "anthropic.claude-3-sonnet-20240229-v1:0",
  "What is your name and something about yourself?"
  // "ENABLED",
  // "<your-guardrail-id>",
  // "DRAFT",
  // { tagSuffix: "test", streamProcessingMode: "SYNCHRONOUS" }
);

/**
 * Tests a BedrockChat model
 * @param title The name of the test to run
 * @param defaultRegion The AWS region to default back to if not set via environment
 * @param model The model string to test
 * @param message The prompt test to send to the LLM
 * @param modelKwargs Optional guardrail configuration
 * @param trace Optional trace setting
 * @param guardrailIdentifier Optional guardrail identifier
 * @param guardrailVersion Optional guardrail version
 * @param guardrailConfig Optional guardrail configuration
 */
async function testChatModel(
  title: string,
  defaultRegion: string,
  model: string,
  message: string,
  modelKwargs?: Record<string, unknown>,
  trace?: "ENABLED" | "DISABLED",
  guardrailIdentifier?: string,
  guardrailVersion?: string,
  guardrailConfig?: {
    tagSuffix: string;
    streamProcessingMode: "SYNCHRONOUS" | "ASYNCHRONOUS";
  }
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
        // sessionToken: process.env.BEDROCK_AWS_SESSION_TOKEN,
      },
      modelKwargs,
      ...(trace &&
        guardrailIdentifier &&
        guardrailVersion && {
          trace,
          guardrailIdentifier,
          guardrailVersion,
          guardrailConfig,
        }),
    });

    const res = await bedrock.invoke([new HumanMessage(message)]);
    console.log(res, res.content);

    expect(res).toBeDefined();
    if (trace && guardrailIdentifier && guardrailVersion) {
      expect(bedrock.trace).toBe(trace);
      expect(bedrock.guardrailIdentifier).toBe(guardrailIdentifier);
      expect(bedrock.guardrailVersion).toBe(guardrailVersion);
      expect(bedrock.guardrailConfig).toEqual(guardrailConfig);
    }
  });
}

/**
 * Tests a BedrockChat model with a streaming response
 * @param title The name of the test to run
 * @param defaultRegion The AWS region to default back to if not set via environment
 * @param model The model string to test
 * @param message The prompt test to send to the LLM
 * @param modelKwargs Optional guardrail configuration
 * @param trace Optional trace setting
 * @param guardrailIdentifier Optional guardrail identifier
 * @param guardrailVersion Optional guardrail version
 * @param guardrailConfig Optional guardrail configuration
 */
async function testChatStreamingModel(
  title: string,
  defaultRegion: string,
  model: string,
  message: string,
  modelKwargs?: Record<string, unknown>,
  trace?: "ENABLED" | "DISABLED",
  guardrailIdentifier?: string,
  guardrailVersion?: string,
  guardrailConfig?: {
    tagSuffix: string;
    streamProcessingMode: "SYNCHRONOUS" | "ASYNCHRONOUS";
  }
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
        // sessionToken: process.env.BEDROCK_AWS_SESSION_TOKEN,
      },
      modelKwargs,
      ...(trace &&
        guardrailIdentifier &&
        guardrailVersion && {
          trace,
          guardrailIdentifier,
          guardrailVersion,
          guardrailConfig,
        }),
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
 * @param trace Optional trace setting
 * @param guardrailIdentifier Optional guardrail identifier
 * @param guardrailVersion Optional guardrail version
 * @param guardrailConfig Optional guardrail configuration
 */
async function testChatHandleLLMNewToken(
  title: string,
  defaultRegion: string,
  model: string,
  message: string,
  trace?: "ENABLED" | "DISABLED",
  guardrailIdentifier?: string,
  guardrailVersion?: string,
  guardrailConfig?: {
    tagSuffix: string;
    streamProcessingMode: "SYNCHRONOUS" | "ASYNCHRONOUS";
  }
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
        // sessionToken: process.env.BEDROCK_AWS_SESSION_TOKEN,
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
      ...(trace &&
        guardrailIdentifier &&
        guardrailVersion && {
          trace,
          guardrailIdentifier,
          guardrailVersion,
          guardrailConfig,
        }),
    });
    const stream = await bedrock.invoke([new HumanMessage(message)]);
    expect(tokens.length).toBeGreaterThan(1);
    expect(stream.content).toEqual(tokens.join(""));
  });
}

test.skip("Tool calling agent with Anthropic", async () => {
  const tools = [new TavilySearchResults({ maxResults: 1 })];
  const region = process.env.BEDROCK_AWS_REGION;
  const bedrock = new BedrockChatWeb({
    maxTokens: 200,
    region,
    model: "anthropic.claude-3-sonnet-20240229-v1:0",
    maxRetries: 0,
    credentials: {
      secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
      accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
    },
  });
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);
  const agent = await createToolCallingAgent({
    llm: bedrock,
    tools,
    prompt,
  });
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });
  const input = "what is the current weather in SF?";
  const result = await agentExecutor.invoke({
    input,
  });
  console.log(result);
});

test.skip.each([
  "amazon.titan-text-express-v1",
  // These models should be supported in the future
  // "amazon.titan-text-lite-v1",
  // "amazon.titan-text-agile-v1",
])("Test Bedrock base chat model: %s", async (model) => {
  const region = process.env.BEDROCK_AWS_REGION ?? "us-west-2";

  const bedrock = new BedrockChatWeb({
    region,
    model,
    maxRetries: 0,
    modelKwargs: {},
    credentials: {
      secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
      accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
      // sessionToken: process.env.BEDROCK_AWS_SESSION_TOKEN,
    },
  });

  const res = await bedrock.invoke([new HumanMessage("What is your name?")]);
  console.log(res);

  expect(res.content.length).toBeGreaterThan(1);
});
