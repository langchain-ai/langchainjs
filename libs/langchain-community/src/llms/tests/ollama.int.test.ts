import { test } from "@jest/globals";
import { PromptTemplate } from "@langchain/core/prompts";
import {
  BytesOutputParser,
  StringOutputParser,
} from "@langchain/core/output_parsers";
import { Ollama } from "../ollama.js";

test.skip("test call", async () => {
  const ollama = new Ollama({});
  const result = await ollama.call(
    "What is a good name for a company that makes colorful socks?"
  );
  console.log({ result });
});

test.skip("test call with callback", async () => {
  const ollama = new Ollama({
    baseUrl: "http://localhost:11434",
  });
  const tokens: string[] = [];
  const result = await ollama.predict(
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

test.skip("test streaming call", async () => {
  const ollama = new Ollama({
    baseUrl: "http://localhost:11434",
  });
  const stream = await ollama.stream(
    `Translate "I love programming" into German.`
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  console.log(chunks.join(""));
  expect(chunks.length).toBeGreaterThan(1);
});

test.skip("should abort the request", async () => {
  const ollama = new Ollama({
    baseUrl: "http://localhost:11434",
  });
  const controller = new AbortController();

  await expect(() => {
    const ret = ollama.call("Respond with an extremely verbose response", {
      signal: controller.signal,
    });
    controller.abort();
    return ret;
  }).rejects.toThrow("This operation was aborted");
});

test.skip("should stream through with a bytes output parser", async () => {
  const TEMPLATE = `You are a pirate named Patchy. All responses must be extremely verbose and in pirate dialect.

  User: {input}
  AI:`;

  const prompt = PromptTemplate.fromTemplate(TEMPLATE);

  const ollama = new Ollama({
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
  console.log(chunks.join(""));
  expect(chunks.length).toBeGreaterThan(1);
});

test.skip("JSON mode", async () => {
  const TEMPLATE = `You are a pirate named Patchy. All responses must be in pirate dialect and in JSON format, with a property named "response" followed by the value.

  User: {input}
  AI:`;

  // Infer the input variables from the template
  const prompt = PromptTemplate.fromTemplate(TEMPLATE);

  const ollama = new Ollama({
    model: "llama2",
    baseUrl: "http://127.0.0.1:11434",
    format: "json",
  });
  const outputParser = new StringOutputParser();
  const chain = prompt.pipe(ollama).pipe(outputParser);
  const res = await chain.invoke({
    input: `Translate "I love programming" into German.`,
  });
  console.log(res);
  expect(JSON.parse(res).response).toBeDefined();
});
