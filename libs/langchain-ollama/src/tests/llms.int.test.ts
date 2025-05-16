import { test, expect } from "@jest/globals";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { PromptTemplate } from "@langchain/core/prompts";
import {
  BytesOutputParser,
  StringOutputParser,
} from "@langchain/core/output_parsers";
import { Ollama } from "../llms.js";

test("test call", async () => {
  const ollama = new Ollama({});
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await ollama.invoke(
    "What is a good name for a company that makes colorful socks?"
  );
  // console.log({ result });
});

test("test call with callback", async () => {
  const ollama = new Ollama();
  const tokens: string[] = [];
  const result = await ollama.invoke(
    "What is a good name for a company that makes colorful socks?",
    {
      callbacks: [
        {
          handleLLMNewToken(token) {
            tokens.push(token);
          },
        },
      ],
    }
  );
  expect(tokens.length).toBeGreaterThan(1);
  expect(result).toEqual(tokens.join(""));
});

test("test streaming call", async () => {
  const ollama = new Ollama();
  const stream = await ollama.stream(
    `Translate "I love programming" into German.`
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  // console.log(chunks.join(""));
  expect(chunks.length).toBeGreaterThan(1);
});

test("should abort the request", async () => {
  const ollama = new Ollama();
  const controller = new AbortController();

  await expect(() => {
    const ret = ollama.invoke("Respond with an extremely verbose response", {
      signal: controller.signal,
    });
    controller.abort();
    return ret;
  }).rejects.toThrow("This operation was aborted");
});

test("should stream through with a bytes output parser", async () => {
  const TEMPLATE = `You are a pirate named Patchy. All responses must be extremely verbose and in pirate dialect.

  User: {input}
  AI:`;

  const prompt = PromptTemplate.fromTemplate(TEMPLATE);

  const ollama = new Ollama({
    model: "llama3",
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
  // console.log(chunks.join(""));
  expect(chunks.length).toBeGreaterThan(1);
});

test("JSON mode", async () => {
  const TEMPLATE = `You are a pirate named Patchy. All responses must be in pirate dialect and in JSON format, with a property named "response" followed by the value.

  User: {input}
  AI:`;

  // Infer the input variables from the template
  const prompt = PromptTemplate.fromTemplate(TEMPLATE);

  const ollama = new Ollama({
    model: "llama3",
    format: "json",
  });
  const outputParser = new StringOutputParser();
  const chain = prompt.pipe(ollama).pipe(outputParser);
  const res = await chain.invoke({
    input: `Translate "I love programming" into German.`,
  });
  // console.log(res);
  expect(JSON.parse(res).response).toBeDefined();
});

test("Test Ollama with an image", async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const imageData = await fs.readFile(path.join(__dirname, "/data/hotdog.jpg"));
  const model = new Ollama({
    model: "llava",
  }).withConfig({
    images: [imageData.toString("base64")],
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke("What's in this image?");
  // console.log({ res });
});
