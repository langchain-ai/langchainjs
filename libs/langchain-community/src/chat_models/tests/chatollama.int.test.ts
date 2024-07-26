import { test } from "@jest/globals";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { PromptTemplate } from "@langchain/core/prompts";
import {
  BytesOutputParser,
  StringOutputParser,
} from "@langchain/core/output_parsers";
import { ChatOllama } from "../ollama.js";

test.skip("test call", async () => {
  const ollama = new ChatOllama({});
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await ollama.invoke(
    "What is a good name for a company that makes colorful socks?"
  );
  // console.log({ result });
});

test.skip("test call with callback", async () => {
  const ollama = new ChatOllama({
    baseUrl: "http://localhost:11434",
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
  expect(result).toEqual(tokens.join(""));
});

test.skip("test streaming call", async () => {
  const ollama = new ChatOllama({
    baseUrl: "http://localhost:11434",
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

test.skip("should abort the request", async () => {
  const ollama = new ChatOllama({
    baseUrl: "http://localhost:11434",
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

test.skip("Test multiple messages", async () => {
  const model = new ChatOllama({ baseUrl: "http://localhost:11434" });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke([
    new HumanMessage({ content: "My name is Jonas" }),
  ]);
  // console.log({ res });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res2 = await model.invoke([
    new HumanMessage("My name is Jonas"),
    new AIMessage(
      "Hello Jonas! It's nice to meet you. Is there anything I can help you with?"
    ),
    new HumanMessage("What did I say my name was?"),
  ]);
  // console.log({ res2 });
});

test.skip("should stream through with a bytes output parser", async () => {
  const TEMPLATE = `You are a pirate named Patchy. All responses must be extremely verbose and in pirate dialect.

  User: {input}
  AI:`;

  // Infer the input variables from the template
  const prompt = PromptTemplate.fromTemplate(TEMPLATE);

  const ollama = new ChatOllama({
    model: "llama2",
    baseUrl: "http://127.0.0.1:11434",
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

test.skip("JSON mode", async () => {
  const TEMPLATE = `You are a pirate named Patchy. All responses must be in pirate dialect and in JSON format, with a property named "response" followed by the value.

  User: {input}
  AI:`;

  // Infer the input variables from the template
  const prompt = PromptTemplate.fromTemplate(TEMPLATE);

  const ollama = new ChatOllama({
    model: "llama2",
    baseUrl: "http://127.0.0.1:11434",
    format: "json",
  });
  const outputParser = new StringOutputParser();
  const chain = prompt.pipe(ollama).pipe(outputParser);
  const res = await chain.invoke({
    input: `Translate "I love programming" into German.`,
  });
  expect(JSON.parse(res).response).toBeDefined();
});

test.skip("Test ChatOllama with an image", async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const imageData = await fs.readFile(path.join(__dirname, "/data/hotdog.jpg"));
  const chat = new ChatOllama({
    model: "llava",
    baseUrl: "http://127.0.0.1:11434",
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
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
  // console.log({ res });
});

test.skip("test max tokens (numPredict)", async () => {
  const ollama = new ChatOllama({
    numPredict: 10,
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

  // console.log({ numTokens, response });
  // Ollama doesn't always stream back the exact number of tokens, so we
  // check for a number which is slightly above the `numPredict`.
  expect(numTokens).toBeLessThanOrEqual(12);
});
