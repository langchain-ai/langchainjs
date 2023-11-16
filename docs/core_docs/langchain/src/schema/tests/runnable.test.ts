/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";
import { test } from "@jest/globals";
import { createChatMessageChunkEncoderStream } from "../../chat_models/base.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";
import { StructuredOutputParser } from "../../output_parsers/structured.js";
import {
  RunnableMap,
  RunnableSequence,
  RouterRunnable,
  RunnableLambda,
} from "../runnable/index.js";
import { Document } from "../../document.js";
import { OutputParserException, StringOutputParser } from "../output_parser.js";

import {
  FakeLLM,
  FakeRetriever,
  FakeChatModel,
  FakeRunnable,
  FakeStreamingLLM,
  FakeSplitIntoListParser,
} from "./lib.js";

test("Test batch", async () => {
  const llm = new FakeLLM({});
  const results = await llm.batch(["Hi there!", "Hey hey"]);
  expect(results.length).toBe(2);
});

test("Test stream", async () => {
  const llm = new FakeLLM({});
  const stream = await llm.stream("Hi there!");
  const reader = stream
    .pipeThrough(new TextEncoderStream())
    .pipeThrough(new TextDecoderStream())
    .getReader();
  let done = false;
  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
  }
});

test("Test chat model stream", async () => {
  const llm = new FakeChatModel({});
  const stream = await llm.stream("Hi there!");
  const reader = stream
    .pipeThrough(createChatMessageChunkEncoderStream())
    .pipeThrough(new TextDecoderStream())
    .getReader();
  let done = false;
  while (!done) {
    const chunk = await reader.read();
    console.log(chunk);
    done = chunk.done;
  }
});

test("Pipe from one runnable to the next", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeLLM({});
  const runnable = promptTemplate.pipe(llm);
  const result = await runnable.invoke({ input: "Hello world!" });
  console.log(result);
  expect(result).toBe("Hello world!");
});

test("Create a runnable sequence and run it", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeChatModel({});
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({ outputValue: z.string().describe("A test value") })
  );
  const text = `\`\`\`
{"outputValue": "testing"}
\`\`\``;
  const runnable = promptTemplate.pipe(llm).pipe(parser);
  const result = await runnable.invoke({ input: text });
  console.log(result);
  expect(result).toEqual({ outputValue: "testing" });
});

test("Create a runnable sequence with a static method with invalid output and catch the error", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeChatModel({});
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({ outputValue: z.string().describe("A test value") })
  );
  const runnable = RunnableSequence.from([promptTemplate, llm, parser]);
  await expect(async () => {
    const result = await runnable.invoke({ input: "Hello sequence!" });
    console.log(result);
  }).rejects.toThrow(OutputParserException);
});

test("Create a runnable sequence with a runnable map", async () => {
  const promptTemplate = ChatPromptTemplate.fromMessages<{
    documents: string;
    question: string;
  }>([
    SystemMessagePromptTemplate.fromTemplate(`You are a nice assistant.`),
    HumanMessagePromptTemplate.fromTemplate(
      `Context:\n{documents}\n\nQuestion:\n{question}`
    ),
  ]);
  const llm = new FakeChatModel({});
  const inputs = {
    question: (input: string) => input,
    documents: RunnableSequence.from([
      new FakeRetriever(),
      (docs: Document[]) => JSON.stringify(docs),
    ]),
    extraField: new FakeLLM({}),
  };
  const runnable = new RunnableMap({ steps: inputs })
    .pipe(promptTemplate)
    .pipe(llm);
  const result = await runnable.invoke("Do you know the Muffin Man?");
  console.log(result);
  expect(result.content).toEqual(
    `You are a nice assistant.\nContext:\n[{"pageContent":"foo","metadata":{}},{"pageContent":"bar","metadata":{}}]\n\nQuestion:\nDo you know the Muffin Man?`
  );
});

test("Stream the entire way through", async () => {
  const llm = new FakeStreamingLLM({});
  const stream = await llm.pipe(new StringOutputParser()).stream("Hi there!");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    console.log(chunk);
  }
  expect(chunks.length).toEqual("Hi there!".length);
  expect(chunks.join("")).toEqual("Hi there!");
});

test("Don't use intermediate streaming", async () => {
  const llm = new FakeStreamingLLM({});
  const stream = await llm
    .pipe(new StringOutputParser())
    .pipe(new FakeLLM({}))
    .stream("Hi there!");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    console.log(chunk);
  }
  expect(chunks.length).toEqual(1);
  expect(chunks[0]).toEqual("Hi there!");
});

test("Router runnables", async () => {
  const mathLLM = new FakeLLM({});
  mathLLM.response = "I am a math genius!";
  const chain1 = PromptTemplate.fromTemplate(
    "You are a math genius. Answer the question: {question}"
  ).pipe(mathLLM);
  const englishLLM = new FakeLLM({});
  englishLLM.response = "I am an English genius!";
  const chain2 = PromptTemplate.fromTemplate(
    "You are an english major. Answer the question: {question}"
  ).pipe(englishLLM);
  const router = new RouterRunnable({
    runnables: { math: chain1, english: chain2 },
  });
  type RouterChainInput = {
    key: string;
    question: string;
  };
  const chain = RunnableSequence.from([
    {
      key: (x: RouterChainInput) => x.key,
      input: { question: (x: RouterChainInput) => x.question },
    },
    router,
  ]);
  const result = await chain.invoke({ key: "math", question: "2 + 2" });
  expect(result).toEqual("I am a math genius!");

  const result2 = await chain.batch([
    {
      key: "math",
      question: "2 + 2",
    },
    {
      key: "english",
      question: "2 + 2",
    },
  ]);
  expect(result2).toEqual(["I am a math genius!", "I am an English genius!"]);
});

test("RunnableLambda that returns a runnable should invoke the runnable", async () => {
  const runnable = new RunnableLambda({
    func: () =>
      new RunnableLambda({
        func: () => "testing",
      }),
  });
  const result = await runnable.invoke({});
  expect(result).toEqual("testing");
});

test("RunnableEach", async () => {
  const parser = new FakeSplitIntoListParser();
  expect(await parser.invoke("first item, second item")).toEqual([
    "first item",
    "second item",
  ]);
  expect(await parser.map().invoke(["a, b", "c"])).toEqual([["a", "b"], ["c"]]);
  expect(
    await parser
      .map()
      .map()
      .invoke([["a, b", "c"], ["c, e"]])
  ).toEqual([[["a", "b"], ["c"]], [["c", "e"]]]);
});

test("Runnable withConfig", async () => {
  const fake = new FakeRunnable({
    returnOptions: true,
  });
  const result = await fake.withConfig({ tags: ["a-tag"] }).invoke("hello");
  expect(result.tags).toEqual(["a-tag"]);
  const stream = await fake
    .withConfig({
      metadata: {
        a: "b",
        b: "c",
      },
      tags: ["a-tag"],
    })
    .stream("hi", { tags: ["b-tag"], metadata: { a: "updated" } });
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toEqual(1);
  expect(chunks[0]?.tags).toEqual(["a-tag", "b-tag"]);
  expect(chunks[0]?.metadata).toEqual({ a: "updated", b: "c" });
});
