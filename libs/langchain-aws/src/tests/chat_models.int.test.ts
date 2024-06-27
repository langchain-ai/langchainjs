/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { AIMessageChunk, HumanMessage } from "@langchain/core/messages";
import { ChatBedrockConverse } from "../chat_models.js";

const baseConstructorArgs: Partial<
  ConstructorParameters<typeof ChatBedrockConverse>[0]
> = {
  region: process.env.BEDROCK_AWS_REGION ?? "us-east-1",
  credentials: {
    secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
    accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
  },
};

test("Test ChatBedrockConverse can invoke", async () => {
  const model = new ChatBedrockConverse({
    ...baseConstructorArgs,
    maxTokens: 5,
  });
  const res = await model.invoke([new HumanMessage("Print hello world")]);
  console.log({ res });
  expect(typeof res.content).toBe("string");
  expect(res.content.length).toBeGreaterThan(1);
  expect(res.content).not.toContain("world");
});

test.only("Test ChatBedrockConverse stream method", async () => {
  const model = new ChatBedrockConverse({
    ...baseConstructorArgs,
    // maxTokens: 50,
  });
  const stream = await model.stream("Print hello world.");
  const chunks = [];
  for await (const chunk of stream) {
    // console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test("Test ChatBedrockConverse in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new ChatBedrockConverse({
    ...baseConstructorArgs,
    streaming: true,
    maxTokens: 10,
    callbacks: [
      {
        async handleLLMNewToken(token: string) {
          nrNewTokens += 1;
          streamedCompletion += token;
        },
      },
    ],
  });
  const message = new HumanMessage("Hello!");
  const result = await model.invoke([message]);
  console.log(result);

  expect(nrNewTokens > 0).toBe(true);
  expect(result.content).toBe(streamedCompletion);
}, 10000);

test("Test ChatBedrockConverse with stop", async () => {
  const model = new ChatBedrockConverse({
    ...baseConstructorArgs,
    maxTokens: 5,
  });
  const res = await model.invoke([new HumanMessage("Print hello world")], {
    stop: ["world"],
  });
  console.log({ res });
  expect(typeof res.content).toBe("string");
  expect(res.content.length).toBeGreaterThan(1);
  expect(res.content).not.toContain("world");
});

// AbortSignal not implemented yet.
test.skip("Test ChatBedrockConverse stream method with abort", async () => {
  await expect(async () => {
    const model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      maxTokens: 100,
    });
    const stream = await model.stream(
      "How is your day going? Be extremely verbose.",
      {
        signal: AbortSignal.timeout(500),
      }
    );
    for await (const chunk of stream) {
      console.log(chunk);
    }
  }).rejects.toThrow();
});

test("Test ChatBedrockConverse stream method with early break", async () => {
  const model = new ChatBedrockConverse({
    ...baseConstructorArgs,
    maxTokens: 50,
  });
  const stream = await model.stream(
    "How is your day going? Be extremely verbose."
  );
  let i = 0;
  for await (const chunk of stream) {
    console.log(chunk);
    i += 1;
    if (i > 10) {
      break;
    }
  }
});

test("Streaming tokens can be found in usage_metadata field", async () => {
  const model = new ChatBedrockConverse();
  const response = await model.stream("Hello, how are you?");
  let finalResult: AIMessageChunk | undefined;
  for await (const chunk of response) {
    if (finalResult) {
      finalResult = finalResult.concat(chunk);
    } else {
      finalResult = chunk;
    }
  }
  console.log({
    usage_metadata: finalResult?.usage_metadata,
  });
  expect(finalResult).toBeTruthy();
  expect(finalResult?.usage_metadata).toBeTruthy();
  expect(finalResult?.usage_metadata?.input_tokens).toBeGreaterThan(0);
  expect(finalResult?.usage_metadata?.output_tokens).toBeGreaterThan(0);
  expect(finalResult?.usage_metadata?.total_tokens).toBeGreaterThan(0);
});

test("populates ID field on AIMessage", async () => {
  const model = new ChatBedrockConverse();
  const response = await model.invoke("Hell");
  console.log({
    invokeId: response.id,
  });
  expect(response.id?.length).toBeGreaterThan(1);
  expect(response?.id?.startsWith("chatcmpl-")).toBe(true);

  // Streaming
  let finalChunk: AIMessageChunk | undefined;
  for await (const chunk of await model.stream("Hell")) {
    if (!finalChunk) {
      finalChunk = chunk;
    } else {
      finalChunk = finalChunk.concat(chunk);
    }
  }
  console.log({
    streamId: finalChunk?.id,
  });
  expect(finalChunk?.id?.length).toBeGreaterThan(1);
  expect(finalChunk?.id?.startsWith("chatcmpl-")).toBe(true);
});
