/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";
import { test } from "@jest/globals";
import { LLM } from "../../llms/base.js";
import {
  BaseChatModel,
  createChatMessageChunkEncoderStream,
} from "../../chat_models/base.js";
import {
  AIMessage,
  BaseMessage,
  ChatResult,
  GenerationChunk,
} from "../index.js";
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
  Runnable,
} from "../runnable/index.js";
import { BaseRetriever } from "../retriever.js";
import { Document } from "../../document.js";
import {
  BaseOutputParser,
  OutputParserException,
  StringOutputParser,
} from "../output_parser.js";
import { RunnableBranch } from "../runnable/branch.js";
import { BaseCallbackConfig } from "../../callbacks/manager.js";

/**
 * Parser for comma-separated values. It splits the input text by commas
 * and trims the resulting values.
 */
export class FakeSplitIntoListParser extends BaseOutputParser<string[]> {
  lc_namespace = ["tests", "fake"];

  getFormatInstructions() {
    return "";
  }

  async parse(text: string): Promise<string[]> {
    return text.split(",").map((value) => value.trim());
  }
}

class FakeRunnable extends Runnable<string, Record<string, any>> {
  lc_namespace = ["tests", "fake"];

  returnOptions?: boolean;

  constructor(fields: { returnOptions?: boolean }) {
    super(fields);
    this.returnOptions = fields.returnOptions;
  }

  async invoke(
    input: string,
    options?: Partial<BaseCallbackConfig>
  ): Promise<Record<string, any>> {
    if (this.returnOptions) {
      return options ?? {};
    }
    return { input };
  }
}

class FakeLLM extends LLM {
  response?: string;

  thrownErrorString?: string;

  constructor(fields: { response?: string; thrownErrorString?: string }) {
    super({});
    this.response = fields.response;
    this.thrownErrorString = fields.thrownErrorString;
  }

  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }
    return this.response ?? prompt;
  }
}

class FakeStreamingLLM extends LLM {
  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    return prompt;
  }

  async *_streamResponseChunks(input: string) {
    for (const c of input) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      yield { text: c, generationInfo: {} } as GenerationChunk;
    }
  }
}

class FakeChatModel extends BaseChatModel {
  _combineLLMOutput() {
    return [];
  }

  _llmType(): string {
    return "fake";
  }

  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    if (options?.stop?.length) {
      return {
        generations: [
          {
            message: new AIMessage(options.stop[0]),
            text: options.stop[0],
          },
        ],
      };
    }
    const text = messages.map((m) => m.content).join("\n");
    return {
      generations: [
        {
          message: new AIMessage(text),
          text,
        },
      ],
      llmOutput: {},
    };
  }
}

class FakeRetriever extends BaseRetriever {
  lc_namespace = ["test", "fake"];

  async _getRelevantDocuments(
    _query: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<Document<Record<string, any>>[]> {
    return [
      new Document({ pageContent: "foo" }),
      new Document({ pageContent: "bar" }),
    ];
  }
}

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

test("Bind kwargs to a runnable", async () => {
  const llm = new FakeChatModel({});
  const result = await llm
    .bind({ stop: ["testing"] })
    .pipe(new StringOutputParser())
    .invoke("Hi there!");
  console.log(result);
  expect(result).toEqual("testing");
});

test("Bind kwargs to a runnable with a batch call", async () => {
  const llm = new FakeChatModel({});
  const result = await llm
    .bind({ stop: ["testing"] })
    .pipe(new StringOutputParser())
    .batch(["Hi there!", "hey hey", "Hi there!", "hey hey"]);
  console.log(result);
  expect(result).toEqual(["testing", "testing", "testing", "testing"]);
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

test("RunnableWithFallbacks", async () => {
  const llm = new FakeLLM({
    thrownErrorString: "Bad error!",
  });
  await expect(async () => {
    const result1 = await llm.invoke("What up");
    console.log(result1);
  }).rejects.toThrow();
  const llmWithFallbacks = llm.withFallbacks({
    fallbacks: [new FakeLLM({})],
  });
  const result2 = await llmWithFallbacks.invoke("What up");
  expect(result2).toEqual("What up");
});

test("RunnableWithFallbacks batch", async () => {
  const llm = new FakeLLM({
    thrownErrorString: "Bad error!",
  });
  await expect(async () => {
    const result1 = await llm.batch(["What up"]);
    console.log(result1);
  }).rejects.toThrow();
  const llmWithFallbacks = llm.withFallbacks({
    fallbacks: [new FakeLLM({})],
  });
  const result2 = await llmWithFallbacks.batch([
    "What up 1",
    "What up 2",
    "What up 3",
  ]);
  expect(result2).toEqual(["What up 1", "What up 2", "What up 3"]);
});

test("Stream with RunnableBinding", async () => {
  const llm = new FakeStreamingLLM({}).bind({ stop: ["dummy"] });
  const stream = await llm.pipe(new StringOutputParser()).stream("Hi there!");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    console.log(chunk);
  }
  expect(chunks.length).toEqual("Hi there!".length);
  expect(chunks.join("")).toEqual("Hi there!");
});

test("Stream through a RunnableBinding if the bound runnable implements transform", async () => {
  const llm = new FakeStreamingLLM({}).bind({ stop: ["dummy"] });
  const outputParser = new StringOutputParser().bind({ callbacks: [] });
  const stream = await llm.pipe(outputParser).stream("Hi there!");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    console.log(chunk);
  }
  expect(chunks.length).toEqual("Hi there!".length);
  expect(chunks.join("")).toEqual("Hi there!");
});

test("RunnableRetry invoke", async () => {
  let attemptCount = 0;
  const runnable = new RunnableLambda({
    func: (_thing: unknown) => {
      attemptCount += 1;
      if (attemptCount < 3) {
        throw new Error("TEST ERROR");
      } else {
        return attemptCount;
      }
    },
  });
  const runnableRetry = runnable.withRetry();
  const result = await runnableRetry.invoke("");
  expect(result).toEqual(3);
});

test("RunnableRetry batch with thrown errors", async () => {
  const runnable = new RunnableLambda({
    func: (_thing: unknown) => {
      throw new Error("TEST ERROR");
    },
  });
  const runnableRetry = runnable.withRetry({
    stopAfterAttempt: 1,
  });
  await expect(async () => {
    await runnableRetry.batch(["", "", ""]);
  }).rejects.toThrow();
});

test("RunnableRetry batch with all returned errors", async () => {
  let attemptCount = 0;
  const runnable = new RunnableLambda({
    func: (_thing: unknown) => {
      attemptCount += 1;
      if (attemptCount < 5) {
        throw new Error("TEST ERROR");
      } else {
        return attemptCount;
      }
    },
  });
  const runnableRetry = runnable.withRetry({
    stopAfterAttempt: 1,
  });
  const result = await runnableRetry.batch(["", "", ""], undefined, {
    returnExceptions: true,
  });
  expect(result).toEqual([
    new Error("TEST ERROR"),
    new Error("TEST ERROR"),
    new Error("TEST ERROR"),
  ]);
});

test("RunnableRetry batch should not retry successful requests", async () => {
  let attemptCount = 0;
  const runnable = new RunnableLambda({
    func: (_thing: unknown) => {
      attemptCount += 1;
      if (attemptCount < 3) {
        throw new Error("TEST ERROR");
      } else {
        return attemptCount;
      }
    },
  });
  const runnableRetry = runnable.withRetry({
    stopAfterAttempt: 2,
  });
  const result = await runnableRetry.batch(["", "", ""]);
  expect(attemptCount).toEqual(5);
  expect(result.sort()).toEqual([3, 4, 5]);
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

test("RunnableBranch invoke", async () => {
  const condition = (x: number) => x > 0;
  const add = (x: number) => x + 1;
  const subtract = (x: number) => x - 1;
  const branch = RunnableBranch.from([
    [condition, add],
    [condition, add],
    subtract,
  ]);
  const result = await branch.invoke(1);
  expect(result).toEqual(2);
  const result2 = await branch.invoke(-1);
  expect(result2).toEqual(-2);
});

test("RunnableBranch batch", async () => {
  const branch = RunnableBranch.from([
    [(x: number) => x > 0 && x < 5, (x: number) => x + 1],
    [(x: number) => x > 5, (x: number) => x * 10],
    (x: number) => x - 1,
  ]);
  const batchResult = await branch.batch([1, 10, 0]);
  expect(batchResult).toEqual([2, 100, -1]);
});

test("RunnableBranch handles error", async () => {
  let error;
  const branch = RunnableBranch.from([
    [
      (x: string) => x.startsWith("a"),
      () => {
        throw new Error("Testing");
      },
    ],
    (x) => `${x} passed`,
  ]);
  const result = await branch.invoke("branch", {
    callbacks: [
      {
        handleChainError: (e) => {
          error = e;
        },
      },
    ],
  });
  expect(result).toBe("branch passed");
  expect(error).toBeUndefined();
  await expect(async () => {
    await branch.invoke("alpha", {
      callbacks: [
        {
          handleChainError: (e) => {
            error = e;
          },
        },
      ],
    });
  }).rejects.toThrow();
  expect(error).toBeDefined();
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
