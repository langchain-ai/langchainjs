/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { AIMessageChunk, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
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

test("Test ChatBedrockConverse stream method", async () => {
  const model = new ChatBedrockConverse({
    ...baseConstructorArgs,
    maxTokens: 50,
  });
  const stream = await model.stream("Print hello world.");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const finalMessage = chunks.map((c) => c.content).join("");
  console.log(finalMessage);
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

test("Test ChatBedrockConverse can invoke tools", async () => {
  const model = new ChatBedrockConverse({
    ...baseConstructorArgs,
  });
  const tools = [
    tool(
      (input) => {
        console.log("tool", input);
        return "Hello";
      },
      {
        name: "get_weather",
        description: "Get the weather",
        schema: z.object({
          location: z.string().describe("Location to get the weather for"),
        }),
      }
    ),
  ];
  const modelWithTools = model.bindTools(tools);
  const result = await modelWithTools.invoke([
    new HumanMessage("Get the weather for London"),
  ]);

  expect(result.tool_calls).toBeDefined();
  expect(result.tool_calls).toHaveLength(1);
  console.log("result.tool_calls?.[0]", result.tool_calls?.[0]);
  expect(result.tool_calls?.[0].name).toBe("get_weather");
  expect(result.tool_calls?.[0].id).toBeDefined();
});

test("Test ChatBedrockConverse can invoke tools with non anthropic model", async () => {
  const model = new ChatBedrockConverse({
    ...baseConstructorArgs,
    model: "cohere.command-r-v1:0",
  });
  const tools = [
    tool(
      (input) => {
        console.log("tool", input);
        return "Hello";
      },
      {
        name: "get_weather",
        description: "Get the weather",
        schema: z.object({
          location: z.string().describe("Location to get the weather for"),
        }),
      }
    ),
  ];
  const modelWithTools = model.bindTools(tools);
  const result = await modelWithTools.invoke([
    new HumanMessage("Get the weather for London"),
  ]);

  expect(result.tool_calls).toBeDefined();
  expect(result.tool_calls).toHaveLength(1);
  console.log("result.tool_calls?.[0]", result.tool_calls?.[0]);
  expect(result.tool_calls?.[0].name).toBe("get_weather");
  expect(result.tool_calls?.[0].id).toBeDefined();
});

test.only("Test ChatBedrockConverse can stream tools", async () => {
  const model = new ChatBedrockConverse({
    ...baseConstructorArgs,
  });
  const tools = [
    tool(
      (input) => {
        console.log("tool", input);
        return "Hello";
      },
      {
        name: "get_weather",
        description: "Get the weather",
        schema: z.object({
          location: z.string().describe("Location to get the weather for"),
        }),
      }
    ),
  ];
  const modelWithTools = model.bindTools(tools);
  const stream = await modelWithTools.stream([
    new HumanMessage("Get the weather for London"),
  ]);

  let finalChunk: AIMessageChunk | undefined;
  for await (const chunk of stream) {
    if (!finalChunk) {
      finalChunk = chunk;
    } else {
      finalChunk = finalChunk.concat(chunk);
    }
  }
  expect(finalChunk?.tool_calls).toBeDefined();
  expect(finalChunk?.tool_calls).toHaveLength(1);
  console.log("result.tool_calls?.[0]", finalChunk?.tool_calls?.[0]);
  expect(finalChunk?.tool_calls?.[0].name).toBe("get_weather");
  expect(finalChunk?.tool_calls?.[0].id).toBeDefined();
});
