import { test, expect } from "vitest";

import fs from "node:fs/promises";
import url from "node:url";
import path from "node:path";

import { z } from "zod/v3";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { PromptTemplate } from "@langchain/core/prompts";
import {
  BytesOutputParser,
  StringOutputParser,
} from "@langchain/core/output_parsers";
import { tool } from "@langchain/core/tools";

import { ChatOllama } from "../chat_models.js";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("test invoke", async () => {
  const ollama = new ChatOllama({
    maxRetries: 1,
  });
  const result = await ollama.invoke([
    "human",
    "What is a good name for a company that makes colorful socks?",
  ]);
  expect(result).toBeDefined();
  expect(typeof result.content).toBe("string");
  expect(result.content.length).toBeGreaterThan(1);
});

test("test call with callback", async () => {
  const ollama = new ChatOllama({
    maxRetries: 1,
  });
  const tokens: string[] = [];
  const result = await ollama.invoke(
    "What is a good name for a company that makes colorful socks?",
    {
      callbacks: [
        {
          handleLLMNewToken(token: string) {
            tokens.push(token);
          },
        },
      ],
    }
  );
  expect(tokens.length).toBeGreaterThan(1);
  expect(result.content).toEqual(tokens.join(""));
});

test("test streaming call", async () => {
  const ollama = new ChatOllama({
    maxRetries: 1,
  });
  const stream = await ollama.stream(
    `Translate "I love programming" into German.`
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test("test streaming call with tools", async () => {
  const ollama = new ChatOllama({
    maxRetries: 1,
    model: "llama3.2",
  }).bindTools([
    tool((input) => JSON.stringify(input), {
      name: "GetWeather",
      description: "Get the current weather in a given location",
    }),
  ]);
  const stream = await ollama.stream(
    `Use the GetWeather tool to get the weather in San Francisco.`
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test("should abort the request", async () => {
  const ollama = new ChatOllama({
    maxRetries: 1,
  });
  const controller = new AbortController();

  await expect(() => {
    const ret = ollama.invoke("Respond with an extremely verbose response", {
      signal: controller.signal,
    });
    controller.abort();
    return ret;
  }).rejects.toThrow("This operation was aborted");
});

test("Test multiple messages", async () => {
  const model = new ChatOllama({
    maxRetries: 1,
  });
  const res = await model.invoke([
    new HumanMessage({ content: "My name is Jonas" }),
  ]);
  expect(res).toBeDefined();
  expect(res.content).toBeDefined();
  const res2 = await model.invoke([
    new HumanMessage("My name is Jonas"),
    new AIMessage(
      "Hello Jonas! It's nice to meet you. Is there anything I can help you with?"
    ),
    new HumanMessage("What did I say my name was?"),
  ]);

  expect(res2).toBeDefined();
  expect(res2.content).toBeDefined();
});

test("should stream through with a bytes output parser", async () => {
  const TEMPLATE = `You are a pirate named Patchy. All responses must be extremely verbose and in pirate dialect.

User: {input}
AI:`;

  // Infer the input variables from the template
  const prompt = PromptTemplate.fromTemplate(TEMPLATE);

  const ollama = new ChatOllama({
    maxRetries: 1,
  });
  const outputParser = new BytesOutputParser();
  const chain = prompt.pipe(ollama).pipe(outputParser);
  const stream = await chain.stream({
    input: `Translate "I love programming" into German.`,
  });
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test("JSON mode", async () => {
  const TEMPLATE = `You are a pirate named Patchy. All responses must be in pirate dialect and in JSON format, with a property named "response" followed by the value.

User: {input}
AI:`;

  // Infer the input variables from the template
  const prompt = PromptTemplate.fromTemplate(TEMPLATE);

  const ollama = new ChatOllama({
    model: "llama3",
    format: "json",
    maxRetries: 1,
  });
  const outputParser = new StringOutputParser();
  const chain = prompt.pipe(ollama).pipe(outputParser);
  const res = await chain.invoke({
    input: `Translate "I love programming" into German.`,
  });
  expect(JSON.parse(res).response).toBeDefined();
});

test.skip("Test ChatOllama with an image", async () => {
  const imageData = await fs.readFile(path.join(__dirname, "/data/hotdog.jpg"));
  const chat = new ChatOllama({
    model: "llava",
    maxRetries: 1,
  });
  const res = await chat.invoke([
    new HumanMessage({
      content: [
        {
          type: "text",
          text: "What is in this image?",
        },
        {
          type: "image_url",
          image_url: `data:image/jpeg;base64,${imageData.toString("base64")}`,
        },
      ],
    }),
  ]);
  expect(res).toBeDefined();
  expect(res.content).toBeDefined();
});

test("test max tokens (numPredict)", async () => {
  const ollama = new ChatOllama({
    numPredict: 10,
    maxRetries: 1,
  }).pipe(new StringOutputParser());
  const stream = await ollama.stream(
    "explain quantum physics to me in as many words as possible"
  );
  let numTokens = 0;
  let response = "";
  for await (const s of stream) {
    numTokens += 1;
    response += s;
  }

  // Ollama doesn't always stream back the exact number of tokens, so we
  // check for a number which is slightly above the `numPredict`.
  expect(numTokens).toBeLessThanOrEqual(12);
});

test("sturctured output with tools", async () => {
  const ollama = new ChatOllama({
    model: "mistral",
    maxRetries: 1,
  });

  const schemaForWSO = z.object({
    location: z.string().describe("The city and state, e.g. San Francisco, CA"),
  });

  const llmWithStructuredOutput = ollama.withStructuredOutput(schemaForWSO, {
    name: "get_current_weather",
    method: "functionCalling",
  });

  const resultFromWSO = await llmWithStructuredOutput.invoke(
    "What's the weather like today in San Francisco? Ensure you use the 'get_current_weather' tool."
  );
  expect(resultFromWSO).toEqual({ location: "San Francisco, CA" });
});
