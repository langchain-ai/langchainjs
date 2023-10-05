/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { test, expect } from "@jest/globals";
import { ChatBedrock } from "../bedrock.js";
import { HumanMessage } from "../../schema/index.js";

test("Test Bedrock chat model: Claude-v2", async () => {
  const region = process.env.BEDROCK_AWS_REGION!;
  const model = "anthropic.claude-v2";

  const bedrock = new ChatBedrock({
    maxTokens: 20,
    region,
    model,
    maxRetries: 0,
    credentials: {
      accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
    },
  });

  const res = await bedrock.call([
    new HumanMessage({ content: "What is your name?" }),
  ]);
  console.log(res);
});

test("Test Bedrock chat model streaming: Claude-v2", async () => {
  const region = process.env.BEDROCK_AWS_REGION!;
  const model = "anthropic.claude-v2";

  const bedrock = new ChatBedrock({
    maxTokens: 200,
    region,
    model,
    maxRetries: 0,
    credentials: {
      accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
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
