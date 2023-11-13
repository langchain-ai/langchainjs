/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { test, expect } from "@jest/globals";
import { ChatBedrock } from "../bedrock/web.js";
import { HumanMessage } from "../../schema/index.js";

test("Test Bedrock chat model: Claude-v2", async () => {
  const region = process.env.BEDROCK_AWS_REGION ?? "us-east-1";
  const model = "anthropic.claude-v2";

  const bedrock = new ChatBedrock({
    maxTokens: 20,
    region,
    model,
    maxRetries: 0,
    credentials: {
      secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
      accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
    },
  });

  const res = await bedrock.call([new HumanMessage("What is your name?")]);
  console.log(res);
});

test("Test Bedrock chat model streaming: Claude-v2", async () => {
  const region = process.env.BEDROCK_AWS_REGION ?? "us-east-1";
  const model = "anthropic.claude-v2";

  const bedrock = new ChatBedrock({
    maxTokens: 200,
    region,
    model,
    maxRetries: 0,
    credentials: {
      secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
      accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
    },
  });

  const stream = await bedrock.stream([
    new HumanMessage({
      content: "What is your name and something about yourself?",
    }),
  ]);
  const chunks = [];
  for await (const chunk of stream) {
    console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test("Test Bedrock chat model handleLLMNewToken: Claude-v2", async () => {
  const region = process.env.BEDROCK_AWS_REGION ?? "us-east-1";
  const model = "anthropic.claude-v2";
  const tokens: string[] = [];

  const bedrock = new ChatBedrock({
    maxTokens: 200,
    region,
    model,
    maxRetries: 0,
    credentials: {
      secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
      accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
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
  const stream = await bedrock.call([
    new HumanMessage("What is your name and something about yourself?"),
  ]);
  expect(tokens.length).toBeGreaterThan(1);
  expect(stream.content).toEqual(tokens.join(""));
});

test.skip.each([
  "amazon.titan-text-express-v1",
  // These models should be supported in the future
  // "amazon.titan-text-lite-v1",
  // "amazon.titan-text-agile-v1",
])("Test Bedrock base chat model: %s", async (model) => {
  const region = process.env.BEDROCK_AWS_REGION ?? "us-east-1";

  const bedrock = new ChatBedrock({
    region,
    model,
    maxRetries: 0,
    modelKwargs: {},
    credentials: {
      secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
      accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
    },
  });

  const res = await bedrock.call([new HumanMessage("What is your name?")]);
  console.log(res);

  expect(res.content.length).toBeGreaterThan(1);
});
