/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Run } from "langsmith";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { jest, test, expect, describe } from "@jest/globals";
import { createChatMessageChunkEncoderStream } from "../../language_models/chat_models.js";
import {
  BaseMessage,
  HumanMessage,
  AIMessageChunk,
  AIMessage,
} from "../../messages/index.js";
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
  SingleRunExtractor,
  FakeStreamingChatModel,
} from "../../utils/testing/index.js";
import { charChunks } from "../../utils/testing/helpers.js";
import { RunnableSequence, RunnableLambda } from "../base.js";
import { RouterRunnable } from "../router.js";
import { RunnableConfig } from "../config.js";
import { JsonOutputParser } from "../../output_parsers/json.js";
import { StructuredTool } from "../../tools/index.js";

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

test("Test stream with an immediate thrown error", async () => {
  const llm = new FakeStreamingLLM({
    thrownErrorString: "testing",
  });
  try {
    await llm.stream("Hi there!");
  } catch (e: any) {
    expect(e.message).toEqual("testing");
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

test("Callback order with transform streaming", async () => {
  const prompt = ChatPromptTemplate.fromTemplate(`{input}`);
  const llm = new FakeStreamingLLM({});
  const order: string[] = [];
  const stream = await prompt
    .pipe(llm)
    .pipe(new StringOutputParser())
    .stream(
      { input: "Hi there!" },
      {
        callbacks: [
          {
            handleChainStart: (chain) =>
              order.push(chain.id[chain.id.length - 1]),
            handleLLMStart: (llm) => order.push(llm.id[llm.id.length - 1]),
          },
        ],
      }
    );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    console.log(chunk);
  }
  expect(order).toEqual([
    "RunnableSequence",
    "ChatPromptTemplate",
    "FakeStreamingLLM",
    "StrOutputParser",
  ]);
  expect(chunks.length).toEqual("Human: Hi there!".length);
  expect(chunks.join("")).toEqual("Human: Hi there!");
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

test("RunnableLambda that returns an async iterator should consume it", async () => {
  const runnable = new RunnableLambda({
    async *func() {
      yield "test";
      yield "ing";
    },
  });
  const result = await runnable.invoke({});
  expect(result).toEqual("testing");
  const chunks = [];
  const stream = await runnable.stream({});
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks).toEqual(["test", "ing"]);
});

test("RunnableLambda that returns an async iterable should consume it", async () => {
  const runnable = new RunnableLambda({
    func() {
      return new ReadableStream({
        async start(controller) {
          controller.enqueue("test");
          controller.enqueue("ing");
          controller.close();
        },
      });
    },
  });
  const result = await runnable.invoke({});
  expect(result).toEqual("testing");
  const chunks = [];
  const stream = await runnable.stream({});
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks).toEqual(["test", "ing"]);
});

test("RunnableLambda that returns a promise for async iterable should consume it", async () => {
  const runnable = new RunnableLambda({
    async func() {
      return new ReadableStream({
        async start(controller) {
          controller.enqueue("test");
          controller.enqueue("ing");
          controller.close();
        },
      });
    },
  });
  const result = await runnable.invoke({});
  expect(result).toEqual("testing");
  const chunks = [];
  const stream = await runnable.stream({});
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks).toEqual(["test", "ing"]);
});

test("RunnableLambda that returns an iterator should consume it", async () => {
  const runnable = new RunnableLambda({
    *func() {
      yield "test";
      yield "ing";
    },
  });
  const result = await runnable.invoke({});
  expect(result).toEqual("testing");
  const chunks = [];
  const stream = await runnable.stream({});
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks).toEqual(["test", "ing"]);
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
  let error: any | undefined;
  try {
    await runnable.invoke({ input: "Hello sequence!" });
  } catch (e: any) {
    error = e;
  }
  expect(error).toBeInstanceOf(OutputParserException);
  expect(error?.lc_error_code).toEqual("OUTPUT_PARSING_FAILURE");
});

test("Create a runnable sequence with a static method with no tags", async () => {
  const seq = RunnableSequence.from([() => "foo", () => "bar"], {
    omitSequenceTags: true,
  });
  const events = [];
  for await (const event of seq.streamEvents({}, { version: "v2" })) {
    events.push(event);
  }
  expect(events.length).toBeGreaterThan(1);
  for (const event of events) {
    expect(event.tags?.find((tag) => tag.startsWith("seq:"))).toBeUndefined();
  }
});

test("RunnableSequence can pass config to every step in batched request", async () => {
  let numSeen = 0;

  const addOne = (x: number, options?: RunnableConfig) => {
    if (options?.configurable?.isPresent === true) {
      numSeen += 1;
    }
    return x + 1;
  };
  const addTwo = (x: number, options?: RunnableConfig) => {
    if (options?.configurable?.isPresent === true) {
      numSeen += 1;
    }
    return x + 2;
  };
  const addThree = (x: number, options?: RunnableConfig) => {
    if (options?.configurable?.isPresent === true) {
      numSeen += 1;
    }
    return x + 3;
  };

  const sequence = RunnableSequence.from([addOne, addTwo, addThree]);

  await sequence.batch([1], {
    configurable: {
      isPresent: true,
    },
  });
  expect(numSeen).toBe(3);
});

test("Should aggregate properly", async () => {
  const model = new FakeStreamingLLM({
    responses: [
      `{"countries": [{"name": "France", "population": 67391582}, {"name": "Spain", "population": 46754778}, {"name": "Japan", "population": 126476461}]}`,
    ],
  });

  // A function that does not operates on input streams and breaks streaming.
  const extractCountryNames = (inputs: Record<string, any>) => {
    if (!Array.isArray(inputs.countries)) {
      return "";
    }
    return inputs.countries.map((country) => country.name);
  };

  const chain = model.pipe(new JsonOutputParser()).pipe(extractCountryNames);

  const stream = await chain.stream(
    `output a list of the countries france, spain and japan and their populations in JSON format. Use a dict with an outer key of "countries" which contains a list of countries. Each country should have the key "name" and "population"`
  );

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toEqual(1);
  expect(chunks[0]).toEqual(["France", "Spain", "Japan"]);
});

describe("runId config", () => {
  test("invoke", async () => {
    const tracer = new SingleRunExtractor();
    const llm = new FakeChatModel({});
    const testId = uuidv4();
    await llm.invoke("gg", {
      callbacks: [tracer],
      runId: testId,
    });
    const run = await tracer.extract();
    expect(run.id).toBe(testId);
  });

  test("batch", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});

    const tracer = new SingleRunExtractor();
    const llm = new FakeChatModel({});
    const message = new HumanMessage("hello world");
    const testId = uuidv4();
    const res = await llm.batch([[message], [message]], {
      callbacks: [tracer],
      runId: testId,
    });
    const run = await tracer.extract();
    expect(run.id).toBe(testId);
    expect(res.length).toBe(2);
    // .batch will warn if a runId is passed
    // along with multiple messages
    expect(console.warn).toBeCalled();
  });

  test("stream", async () => {
    const tracer = new SingleRunExtractor();
    const llm = new FakeStreamingChatModel({});
    const testId = uuidv4();
    const stream = await llm.stream("gg", {
      callbacks: [tracer],
      runId: testId,
    });
    for await (const _ of stream) {
      // no-op
    }
    const run = await tracer.extract();
    expect(run.id).toBe(testId);
  });

  test("stream (via llm)", async () => {
    const tracer = new SingleRunExtractor();
    const llm = new FakeStreamingLLM({});
    const testId = uuidv4();
    const stream = await llm.stream("gg", {
      callbacks: [tracer],
      runId: testId,
    });
    for await (const _ of stream) {
      // no-op
    }
    const run = await tracer.extract();
    expect(run.id).toBe(testId);
  });

  test("invoke (via llm)", async () => {
    const tracer = new SingleRunExtractor();
    const llm = new FakeLLM({});
    const testId = uuidv4();
    await llm.invoke("gg", {
      callbacks: [tracer],
      runId: testId,
    });
    const run = await tracer.extract();
    expect(run.id).toBe(testId);
  });

  describe("FakeStreamingChatModel predefined chunks", () => {
    test("streams predefined chunks including tool call", async () => {
      class EchoTool extends StructuredTool<z.ZodObject<any>> {
        name = "echo";

        description = "Echo the input";

        schema = z.object({ input: z.string() });

        async _call(arg: z.output<this["schema"]>) {
          return JSON.stringify(arg);
        }
      }

      const toolCallChunk = new AIMessageChunk({
        content: "",
        tool_calls: [
          {
            id: "call_1",
            type: "tool_call",
            name: "echo",
            args: { input: "hello" },
          },
        ],
      });

      const chunks = [...charChunks("Hi"), toolCallChunk, ...charChunks("!")];

      const model = new FakeStreamingChatModel({ chunks, sleep: 0 }).bindTools([
        new EchoTool(),
      ]);

      const seen: string[] = [];
      for await (const gen of await model.stream([], {})) {
        seen.push(gen.content as string);
      }
      expect(seen).toEqual(["H", "i", "", "!"]);
    });

    test("FakeStreamingChatModel fallback char streaming", async () => {
      const model = new FakeStreamingChatModel({
        responses: [new AIMessage("Hi")],
        sleep: 0,
      });
      const out: string[] = [];
      for await (const gen of await model.stream([], {})) {
        out.push(gen.content as string);
      }
      expect(out).toEqual(["H", "i"]);
    });
  });
});
