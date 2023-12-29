/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Run } from "langsmith";
import { jest } from "@jest/globals";
import { createChatMessageChunkEncoderStream } from "../../language_models/chat_models.js";
import { BaseMessage } from "../../messages/index.js";
import { OutputParserException } from "../../output_parsers/base.js";
import { StringOutputParser } from "../../output_parsers/string.js";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/chat.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import {
  FakeLLM,
  FakeChatModel,
  FakeStreamingLLM,
  FakeSplitIntoListParser,
  FakeRunnable,
  FakeListChatModel,
} from "../../utils/testing/index.js";
import { RunnableSequence, RunnableLambda } from "../base.js";
import { RouterRunnable } from "../router.js";

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

test("RunnableLambda that returns a streaming runnable should stream output from the inner runnable", async () => {
  const runnable = new RunnableLambda({
    func: () => new FakeStreamingLLM({}),
  });
  const stream = await runnable.stream("hello");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks).toEqual(["h", "e", "l", "l", "o"]);
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

test("Listeners work", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate("You are a nice assistant."),
    ["human", "{question}"],
  ]);
  const model = new FakeListChatModel({
    responses: ["foo"],
  });
  const chain = prompt.pipe(model);

  const mockStart = jest.fn();
  const mockEnd = jest.fn();

  await chain
    .withListeners({
      onStart: (run: Run) => {
        mockStart(run);
      },
      onEnd: (run: Run) => {
        mockEnd(run);
      },
    })
    .invoke({ question: "What is the meaning of life?" });

  expect(mockStart).toHaveBeenCalledTimes(1);
  expect((mockStart.mock.calls[0][0] as { name: string }).name).toBe(
    "RunnableSequence"
  );
  expect(mockEnd).toHaveBeenCalledTimes(1);
});

test("Listeners work with async handlers", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate("You are a nice assistant."),
    ["human", "{question}"],
  ]);
  const model = new FakeListChatModel({
    responses: ["foo"],
  });
  const chain = prompt.pipe(model);

  const mockStart = jest.fn();
  const mockEnd = jest.fn();

  await chain
    .withListeners({
      onStart: async (run: Run) => {
        const promise = new Promise((resolve) => setTimeout(resolve, 2000));
        await promise;
        mockStart(run);
      },
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onEnd: async (run: Run) => {
        const promise = new Promise((resolve) => setTimeout(resolve, 2000));
        await promise;
        mockEnd(run);
      },
    })
    .invoke({ question: "What is the meaning of life?" });

  expect(mockStart).toHaveBeenCalledTimes(1);
  expect((mockStart.mock.calls[0][0] as { name: string }).name).toBe(
    "RunnableSequence"
  );
  expect(mockEnd).toHaveBeenCalledTimes(1);
});

test("Create a runnable sequence and run it", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeChatModel({});
  const parser = new StringOutputParser();
  const text = `Jello world`;
  const runnable = promptTemplate.pipe(llm).pipe(parser);
  const result = await runnable.invoke({ input: text });
  console.log(result);
  expect(result).toEqual("Jello world");
});

test("Create a runnable sequence with a static method with invalid output and catch the error", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeChatModel({});
  const parser = (input: BaseMessage) => {
    console.log(input);
    try {
      const parsedInput =
        typeof input.content === "string"
          ? JSON.parse(input.content)
          : input.content;
      if (
        !("outputValue" in parsedInput) ||
        parsedInput.outputValue !== "Hello sequence!"
      ) {
        throw new Error("Test failed!");
      } else {
        return input;
      }
    } catch (e) {
      throw new OutputParserException("Invalid output");
    }
  };
  const runnable = RunnableSequence.from([promptTemplate, llm, parser]);
  await expect(async () => {
    const result = await runnable.invoke({ input: "Hello sequence!" });
    console.log(result);
  }).rejects.toThrow(OutputParserException);
});
