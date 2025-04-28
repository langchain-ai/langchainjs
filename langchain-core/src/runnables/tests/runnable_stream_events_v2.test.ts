/* eslint-disable no-promise-executor-return */
/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { test, expect, afterEach } from "@jest/globals";
import { z } from "zod";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  RunnableLambda,
  RunnableMap,
  RunnablePassthrough,
  RunnablePick,
} from "../index.js";
import { ChatPromptTemplate } from "../../prompts/chat.js";
import {
  FakeChatModel,
  FakeLLM,
  FakeListChatModel,
  FakeRetriever,
  FakeStreamingLLM,
} from "../../utils/testing/index.js";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
} from "../../messages/index.js";
import { DynamicStructuredTool, DynamicTool, tool } from "../../tools/index.js";
import { Document } from "../../documents/document.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { GenerationChunk } from "../../outputs.js";
// Import from web to avoid top-level side-effects from AsyncLocalStorage
import { dispatchCustomEvent } from "../../callbacks/dispatch/web.js";
import { AsyncLocalStorageProviderSingleton } from "../../singletons/index.js";

function reverse(s: string) {
  // Reverse a string.
  return s.split("").reverse().join("");
}

const originalCallbackValue = process.env.LANGCHAIN_CALLBACKS_BACKGROUND;

afterEach(() => {
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalCallbackValue;
});

test("Runnable streamEvents method", async () => {
  const chain = RunnableLambda.from(reverse).withConfig({
    runName: "reverse",
  });

  const events = [];
  const eventStream = await chain.streamEvents("hello", { version: "v2" });
  for await (const event of eventStream) {
    events.push(event);
  }
  expect(events).toEqual([
    {
      data: { input: "hello" },
      event: "on_chain_start",
      metadata: {},
      name: "reverse",
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { chunk: "olleh" },
      event: "on_chain_stream",
      metadata: {},
      name: "reverse",
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { output: "olleh" },
      event: "on_chain_end",
      metadata: {},
      name: "reverse",
      run_id: expect.any(String),
      tags: [],
    },
  ]);
});

test("Runnable streamEvents method on a chat model", async () => {
  const model = new FakeListChatModel({
    responses: ["abc"],
  });

  const events = [];
  const eventStream = await model.streamEvents("hello", { version: "v2" });
  for await (const event of eventStream) {
    events.push(event);
  }

  // used here to avoid casting every ID
  const anyString = expect.any(String) as unknown as string;

  expect(events).toMatchObject([
    {
      data: { input: "hello" },
      event: "on_chat_model_start",
      name: "FakeListChatModel",
      metadata: expect.any(Object),
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { chunk: new AIMessageChunk({ id: anyString, content: "a" }) },
      event: "on_chat_model_stream",
      name: "FakeListChatModel",
      metadata: expect.any(Object),
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { chunk: new AIMessageChunk({ id: anyString, content: "b" }) },
      event: "on_chat_model_stream",
      name: "FakeListChatModel",
      metadata: expect.any(Object),
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { chunk: new AIMessageChunk({ id: anyString, content: "c" }) },
      event: "on_chat_model_stream",
      name: "FakeListChatModel",
      metadata: expect.any(Object),
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { output: new AIMessageChunk({ id: anyString, content: "abc" }) },
      event: "on_chat_model_end",
      name: "FakeListChatModel",
      metadata: expect.any(Object),
      run_id: expect.any(String),
      tags: [],
    },
  ]);
});

test("Runnable streamEvents call nested in another runnable + passed callbacks should still work", async () => {
  AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
    new AsyncLocalStorage()
  );

  const model = new FakeListChatModel({
    responses: ["abc"],
  });

  const events: any[] = [];
  const container = RunnableLambda.from(async (_) => {
    const eventStream = model.streamEvents("hello", { version: "v2" });
    for await (const event of eventStream) {
      events.push(event);
    }
    return events;
  });

  await container.invoke({}, { callbacks: [{ handleLLMStart: () => {} }] });

  // used here to avoid casting every ID
  const anyString = expect.any(String) as unknown as string;

  expect(events).toMatchObject([
    {
      data: { input: "hello" },
      event: "on_chat_model_start",
      name: "FakeListChatModel",
      metadata: expect.any(Object),
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { chunk: new AIMessageChunk({ id: anyString, content: "a" }) },
      event: "on_chat_model_stream",
      name: "FakeListChatModel",
      metadata: expect.any(Object),
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { chunk: new AIMessageChunk({ id: anyString, content: "b" }) },
      event: "on_chat_model_stream",
      name: "FakeListChatModel",
      metadata: expect.any(Object),
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { chunk: new AIMessageChunk({ id: anyString, content: "c" }) },
      event: "on_chat_model_stream",
      name: "FakeListChatModel",
      metadata: expect.any(Object),
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { output: new AIMessageChunk({ id: anyString, content: "abc" }) },
      event: "on_chat_model_end",
      name: "FakeListChatModel",
      metadata: expect.any(Object),
      run_id: expect.any(String),
      tags: [],
    },
  ]);
});

test("Runnable streamEvents method with three runnables", async () => {
  const r = RunnableLambda.from(reverse);

  const chain = r
    .withConfig({ runName: "1" })
    .pipe(r.withConfig({ runName: "2" }))
    .pipe(r.withConfig({ runName: "3" }));

  const events = [];
  const eventStream = await chain.streamEvents("hello", { version: "v2" });
  for await (const event of eventStream) {
    events.push(event);
  }
  expect(events).toEqual([
    {
      data: { input: "hello" },
      event: "on_chain_start",
      metadata: {},
      name: "RunnableSequence",
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: {},
      event: "on_chain_start",
      metadata: {},
      name: "1",
      run_id: expect.any(String),
      tags: ["seq:step:1"],
    },
    {
      data: { chunk: "olleh" },
      event: "on_chain_stream",
      metadata: {},
      name: "1",
      run_id: expect.any(String),
      tags: ["seq:step:1"],
    },
    {
      data: {},
      event: "on_chain_start",
      metadata: {},
      name: "2",
      run_id: expect.any(String),
      tags: ["seq:step:2"],
    },
    {
      data: { input: "hello", output: "olleh" },
      event: "on_chain_end",
      metadata: {},
      name: "1",
      run_id: expect.any(String),
      tags: ["seq:step:1"],
    },
    {
      data: { chunk: "hello" },
      event: "on_chain_stream",
      metadata: {},
      name: "2",
      run_id: expect.any(String),
      tags: ["seq:step:2"],
    },
    {
      data: {},
      event: "on_chain_start",
      metadata: {},
      name: "3",
      run_id: expect.any(String),
      tags: ["seq:step:3"],
    },
    {
      data: { input: "olleh", output: "hello" },
      event: "on_chain_end",
      metadata: {},
      name: "2",
      run_id: expect.any(String),
      tags: ["seq:step:2"],
    },
    {
      data: { chunk: "olleh" },
      event: "on_chain_stream",
      metadata: {},
      name: "3",
      run_id: expect.any(String),
      tags: ["seq:step:3"],
    },
    {
      data: { chunk: "olleh" },
      event: "on_chain_stream",
      metadata: {},
      name: "RunnableSequence",
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { input: "hello", output: "olleh" },
      event: "on_chain_end",
      metadata: {},
      name: "3",
      run_id: expect.any(String),
      tags: ["seq:step:3"],
    },
    {
      data: { output: "olleh" },
      event: "on_chain_end",
      metadata: {},
      name: "RunnableSequence",
      run_id: expect.any(String),
      tags: [],
    },
  ]);
});

test("Runnable streamEvents method with three runnables with backgrounded callbacks set to true", async () => {
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "true";
  const r = RunnableLambda.from(reverse);

  const chain = r
    .withConfig({ runName: "1" })
    .pipe(r.withConfig({ runName: "2" }))
    .pipe(r.withConfig({ runName: "3" }));

  const events = [];
  const eventStream = await chain.streamEvents("hello", { version: "v2" });
  for await (const event of eventStream) {
    events.push(event);
  }
  expect(events).toEqual([
    {
      data: { input: "hello" },
      event: "on_chain_start",
      metadata: {},
      name: "RunnableSequence",
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: {},
      event: "on_chain_start",
      metadata: {},
      name: "1",
      run_id: expect.any(String),
      tags: ["seq:step:1"],
    },
    {
      data: { chunk: "olleh" },
      event: "on_chain_stream",
      metadata: {},
      name: "1",
      run_id: expect.any(String),
      tags: ["seq:step:1"],
    },
    {
      data: {},
      event: "on_chain_start",
      metadata: {},
      name: "2",
      run_id: expect.any(String),
      tags: ["seq:step:2"],
    },
    {
      data: { input: "hello", output: "olleh" },
      event: "on_chain_end",
      metadata: {},
      name: "1",
      run_id: expect.any(String),
      tags: ["seq:step:1"],
    },
    {
      data: { chunk: "hello" },
      event: "on_chain_stream",
      metadata: {},
      name: "2",
      run_id: expect.any(String),
      tags: ["seq:step:2"],
    },
    {
      data: {},
      event: "on_chain_start",
      metadata: {},
      name: "3",
      run_id: expect.any(String),
      tags: ["seq:step:3"],
    },
    {
      data: { input: "olleh", output: "hello" },
      event: "on_chain_end",
      metadata: {},
      name: "2",
      run_id: expect.any(String),
      tags: ["seq:step:2"],
    },
    {
      data: { chunk: "olleh" },
      event: "on_chain_stream",
      metadata: {},
      name: "3",
      run_id: expect.any(String),
      tags: ["seq:step:3"],
    },
    {
      data: { chunk: "olleh" },
      event: "on_chain_stream",
      metadata: {},
      name: "RunnableSequence",
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { input: "hello", output: "olleh" },
      event: "on_chain_end",
      metadata: {},
      name: "3",
      run_id: expect.any(String),
      tags: ["seq:step:3"],
    },
    {
      data: { output: "olleh" },
      event: "on_chain_end",
      metadata: {},
      name: "RunnableSequence",
      run_id: expect.any(String),
      tags: [],
    },
  ]);
});

test("Runnable streamEvents method with three runnables with filtering", async () => {
  const r = RunnableLambda.from(reverse);

  const chain = r
    .withConfig({ runName: "1" })
    .pipe(r.withConfig({ runName: "2", tags: ["my_tag"] }))
    .pipe(r.withConfig({ runName: "3", tags: ["my_tag"] }));

  const events = [];
  const eventStream = await chain.streamEvents(
    "hello",
    { version: "v2" },
    {
      includeNames: ["1"],
    }
  );
  for await (const event of eventStream) {
    events.push(event);
  }
  expect(events).toEqual([
    {
      data: { input: "hello" },
      event: "on_chain_start",
      metadata: {},
      name: "1",
      run_id: expect.any(String),
      tags: ["seq:step:1"],
    },
    {
      data: { chunk: "olleh" },
      event: "on_chain_stream",
      metadata: {},
      name: "1",
      run_id: expect.any(String),
      tags: ["seq:step:1"],
    },
    {
      data: { output: "olleh" },
      event: "on_chain_end",
      metadata: {},
      name: "1",
      run_id: expect.any(String),
      tags: ["seq:step:1"],
    },
  ]);
  const events2 = [];
  const eventStream2 = await chain.streamEvents(
    "hello",
    { version: "v2" },
    {
      excludeNames: ["2"],
      includeTags: ["my_tag"],
    }
  );
  for await (const event of eventStream2) {
    events2.push(event);
  }
  expect(events2).toEqual([
    {
      data: {
        input: "hello",
      },
      event: "on_chain_start",
      metadata: {},
      name: "3",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["seq:step:3", "my_tag"]),
    },
    {
      data: { chunk: "olleh" },
      event: "on_chain_stream",
      metadata: {},
      name: "3",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["seq:step:3", "my_tag"]),
    },
    {
      data: { output: "olleh" },
      event: "on_chain_end",
      metadata: {},
      name: "3",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["seq:step:3", "my_tag"]),
    },
  ]);
});

test("Runnable streamEvents method with a runnable map", async () => {
  const r = RunnableLambda.from(reverse);

  const chain = RunnableMap.from({
    reversed: r,
    original: new RunnablePassthrough(),
  }).pipe(new RunnablePick("reversed"));

  const events = [];
  const eventStream = await chain.streamEvents("hello", { version: "v2" });
  for await (const event of eventStream) {
    events.push(event);
  }
  expect(events).toEqual([
    {
      run_id: expect.any(String),
      event: "on_chain_start",
      name: "RunnableSequence",
      tags: [],
      metadata: {},
      data: { input: "hello" },
    },
    {
      event: "on_chain_start",
      name: "RunnableMap",
      run_id: expect.any(String),
      tags: ["seq:step:1"],
      metadata: {},
      data: {},
    },
    {
      event: "on_chain_start",
      name: "RunnableLambda",
      run_id: expect.any(String),
      tags: ["map:key:reversed"],
      metadata: {},
      data: {},
    },
    {
      event: "on_chain_start",
      name: "RunnablePassthrough",
      run_id: expect.any(String),
      tags: ["map:key:original"],
      metadata: {},
      data: {},
    },
    {
      event: "on_chain_stream",
      name: "RunnablePassthrough",
      run_id: expect.any(String),
      tags: ["map:key:original"],
      metadata: {},
      data: { chunk: "hello" },
    },
    {
      event: "on_chain_stream",
      name: "RunnableLambda",
      run_id: expect.any(String),
      tags: ["map:key:reversed"],
      metadata: {},
      data: { chunk: "olleh" },
    },
    {
      event: "on_chain_stream",
      name: "RunnableMap",
      run_id: expect.any(String),
      tags: ["seq:step:1"],
      metadata: {},
      data: {
        chunk: {
          original: "hello",
        },
      },
    },
    {
      event: "on_chain_start",
      name: "RunnablePick",
      run_id: expect.any(String),
      tags: ["seq:step:2"],
      metadata: {},
      data: {},
    },
    {
      event: "on_chain_stream",
      name: "RunnableMap",
      run_id: expect.any(String),
      tags: ["seq:step:1"],
      metadata: {},
      data: {
        chunk: {
          reversed: "olleh",
        },
      },
    },
    {
      event: "on_chain_end",
      name: "RunnablePassthrough",
      run_id: expect.any(String),
      tags: ["map:key:original"],
      metadata: {},
      data: { input: "hello", output: "hello" },
    },
    {
      event: "on_chain_stream",
      name: "RunnablePick",
      run_id: expect.any(String),
      tags: ["seq:step:2"],
      metadata: {},
      data: { chunk: "olleh" },
    },
    {
      event: "on_chain_stream",
      run_id: expect.any(String),
      tags: [],
      metadata: {},
      name: "RunnableSequence",
      data: { chunk: "olleh" },
    },
    {
      event: "on_chain_end",
      name: "RunnableLambda",
      run_id: expect.any(String),
      tags: ["map:key:reversed"],
      metadata: {},
      data: { input: "hello", output: "olleh" },
    },
    {
      event: "on_chain_end",
      name: "RunnableMap",
      run_id: expect.any(String),
      tags: ["seq:step:1"],
      metadata: {},
      data: {
        input: "hello",
        output: {
          original: "hello",
          reversed: "olleh",
        },
      },
    },
    {
      event: "on_chain_end",
      name: "RunnablePick",
      run_id: expect.any(String),
      tags: ["seq:step:2"],
      metadata: {},
      data: {
        input: {
          original: "hello",
          reversed: "olleh",
        },
        output: "olleh",
      },
    },
    {
      event: "on_chain_end",
      name: "RunnableSequence",
      run_id: expect.any(String),
      tags: [],
      metadata: {},
      data: { output: "olleh" },
    },
  ]);
});

test("Runnable streamEvents method with llm", async () => {
  const model = new FakeStreamingLLM({
    responses: ["hey!"],
  }).withConfig({
    metadata: { a: "b" },
    tags: ["my_model"],
    runName: "my_model",
  });
  const events = [];
  const eventStream = await model.streamEvents("hello", { version: "v2" });
  for await (const event of eventStream) {
    events.push(event);
  }
  expect(events).toEqual([
    {
      event: "on_llm_start",
      data: {
        input: "hello",
      },
      name: "my_model",
      tags: ["my_model"],
      run_id: expect.any(String),
      metadata: {
        a: "b",
      },
    },
    {
      event: "on_llm_stream",
      data: {
        chunk: {
          text: "h",
        },
      },
      run_id: expect.any(String),
      name: "my_model",
      tags: ["my_model"],
      metadata: {
        a: "b",
      },
    },
    {
      event: "on_llm_stream",
      data: {
        chunk: {
          text: "e",
        },
      },
      run_id: expect.any(String),
      name: "my_model",
      tags: ["my_model"],
      metadata: {
        a: "b",
      },
    },
    {
      event: "on_llm_stream",
      data: {
        chunk: {
          text: "y",
        },
      },
      run_id: expect.any(String),
      name: "my_model",
      tags: ["my_model"],
      metadata: {
        a: "b",
      },
    },
    {
      event: "on_llm_stream",
      data: {
        chunk: {
          text: "!",
        },
      },
      run_id: expect.any(String),
      name: "my_model",
      tags: ["my_model"],
      metadata: {
        a: "b",
      },
    },
    {
      event: "on_llm_end",
      data: {
        output: {
          generations: [
            [
              {
                text: "hey!",
                generationInfo: {},
              },
            ],
          ],
          llmOutput: {},
        },
      },
      run_id: expect.any(String),
      name: "my_model",
      tags: ["my_model"],
      metadata: {
        a: "b",
      },
    },
  ]);
});

test("Runnable streamEvents method with chat model chain", async () => {
  const template = ChatPromptTemplate.fromMessages([
    ["system", "You are Godzilla"],
    ["human", "{question}"],
  ]).withConfig({
    runName: "my_template",
    tags: ["my_template"],
  });
  const model = new FakeListChatModel({
    responses: ["ROAR"],
  }).withConfig({
    metadata: { a: "b" },
    tags: ["my_model"],
    runName: "my_model",
  });
  const chain = template.pipe(model).withConfig({
    metadata: { foo: "bar" },
    tags: ["my_chain"],
    runName: "my_chain",
  });
  const events = [];
  const eventStream = await chain.streamEvents(
    { question: "hello" },
    { version: "v2" }
  );
  for await (const event of eventStream) {
    events.push(event);
  }

  // used here to avoid casting every ID
  const anyString = expect.any(String) as unknown as string;
  expect(events).toEqual([
    {
      run_id: expect.any(String),
      event: "on_chain_start",
      name: "my_chain",
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
      data: {
        input: {
          question: "hello",
        },
      },
    },
    {
      data: { input: { question: "hello" } },
      event: "on_prompt_start",
      metadata: { foo: "bar" },
      name: "my_template",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_chain", "seq:step:1", "my_template"]),
    },
    {
      event: "on_prompt_end",
      name: "my_template",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["seq:step:1", "my_template", "my_chain"]),
      metadata: {
        foo: "bar",
      },
      data: {
        input: {
          question: "hello",
        },
        output: await template.invoke({ question: "hello" }),
      },
    },
    {
      event: "on_chat_model_start",
      name: "my_model",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["seq:step:2", "my_model", "my_chain"]),
      metadata: {
        foo: "bar",
        a: "b",
        ls_model_type: "chat",
        ls_provider: model.getName(),
        ls_stop: undefined,
      },
      data: {
        input: {
          messages: [
            [new SystemMessage("You are Godzilla"), new HumanMessage("hello")],
          ],
        },
      },
    },
    {
      event: "on_chat_model_stream",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_chain", "my_model", "seq:step:2"]),
      metadata: {
        a: "b",
        foo: "bar",
        ls_model_type: "chat",
        ls_provider: model.getName(),
        ls_stop: undefined,
      },
      name: "my_model",
      data: { chunk: new AIMessageChunk({ content: "R", id: anyString }) },
    },
    {
      event: "on_chain_stream",
      run_id: expect.any(String),
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
      name: "my_chain",
      data: { chunk: new AIMessageChunk({ content: "R", id: anyString }) },
    },
    {
      event: "on_chat_model_stream",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_chain", "my_model", "seq:step:2"]),
      metadata: {
        a: "b",
        foo: "bar",
        ls_model_type: "chat",
        ls_provider: model.getName(),
        ls_stop: undefined,
      },
      name: "my_model",
      data: { chunk: new AIMessageChunk({ content: "O", id: anyString }) },
    },
    {
      event: "on_chain_stream",
      run_id: expect.any(String),
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
      name: "my_chain",
      data: { chunk: new AIMessageChunk({ content: "O", id: anyString }) },
    },
    {
      event: "on_chat_model_stream",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_chain", "my_model", "seq:step:2"]),
      metadata: {
        a: "b",
        foo: "bar",
        ls_model_type: "chat",
        ls_provider: model.getName(),
        ls_stop: undefined,
      },
      name: "my_model",
      data: { chunk: new AIMessageChunk({ content: "A", id: anyString }) },
    },
    {
      event: "on_chain_stream",
      run_id: expect.any(String),
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
      name: "my_chain",
      data: { chunk: new AIMessageChunk({ content: "A", id: anyString }) },
    },
    {
      event: "on_chat_model_stream",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_chain", "my_model", "seq:step:2"]),
      metadata: {
        a: "b",
        foo: "bar",
        ls_model_type: "chat",
        ls_provider: model.getName(),
        ls_stop: undefined,
      },
      name: "my_model",
      data: { chunk: new AIMessageChunk({ content: "R", id: anyString }) },
    },
    {
      event: "on_chain_stream",
      run_id: expect.any(String),
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
      name: "my_chain",
      data: { chunk: new AIMessageChunk({ content: "R", id: anyString }) },
    },
    {
      event: "on_chat_model_end",
      name: "my_model",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["seq:step:2", "my_model", "my_chain"]),
      metadata: {
        foo: "bar",
        a: "b",
        ls_model_type: "chat",
        ls_provider: model.getName(),
        ls_stop: undefined,
      },
      data: {
        input: {
          messages: [
            [new SystemMessage("You are Godzilla"), new HumanMessage("hello")],
          ],
        },
        output: new AIMessageChunk({ content: "ROAR", id: anyString }),
      },
    },
    {
      event: "on_chain_end",
      name: "my_chain",
      run_id: expect.any(String),
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
      data: { output: new AIMessageChunk({ content: "ROAR", id: anyString }) },
    },
  ]);
});

test("Chat model that supports streaming, but is invoked, should still emit on_stream events", async () => {
  const template = ChatPromptTemplate.fromMessages([
    ["system", "You are Godzilla"],
    ["human", "{question}"],
  ]).withConfig({
    runName: "my_template",
    tags: ["my_template"],
  });
  const model = new FakeListChatModel({
    responses: ["ROAR"],
  }).withConfig({
    metadata: { a: "b" },
    tags: ["my_model"],
    runName: "my_model",
  });
  const chain = template
    .pipe(async (val, config) => {
      const result = await model.invoke(val, config);
      return result;
    })
    .withConfig({
      metadata: { foo: "bar" },
      tags: ["my_chain"],
      runName: "my_chain",
    });
  const events = [];
  const eventStream = await chain.streamEvents(
    { question: "hello" },
    { version: "v2" }
  );
  for await (const event of eventStream) {
    events.push(event);
  }

  // used here to avoid casting every ID
  const anyString = expect.any(String) as unknown as string;

  expect(events).toEqual([
    {
      run_id: expect.any(String),
      event: "on_chain_start",
      name: "my_chain",
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
      data: {
        input: {
          question: "hello",
        },
      },
    },
    {
      data: { input: { question: "hello" } },
      event: "on_prompt_start",
      metadata: { foo: "bar" },
      name: "my_template",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_chain", "seq:step:1", "my_template"]),
    },
    {
      event: "on_prompt_end",
      name: "my_template",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["seq:step:1", "my_template", "my_chain"]),
      metadata: {
        foo: "bar",
      },
      data: {
        input: {
          question: "hello",
        },
        output: await template.invoke({ question: "hello" }),
      },
    },
    {
      event: "on_chain_start",
      data: {},
      name: "RunnableLambda",
      tags: ["seq:step:2", "my_chain"],
      run_id: expect.any(String),
      metadata: {
        foo: "bar",
      },
    },
    {
      event: "on_chat_model_start",
      name: "my_model",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_model", "my_chain"]),
      metadata: {
        foo: "bar",
        a: "b",
        ls_model_type: "chat",
        ls_stop: undefined,
        ls_provider: model.getName(),
      },
      data: {
        input: {
          messages: [
            [new SystemMessage("You are Godzilla"), new HumanMessage("hello")],
          ],
        },
      },
    },
    {
      event: "on_chat_model_stream",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_chain", "my_model"]),
      metadata: {
        a: "b",
        foo: "bar",
        ls_model_type: "chat",
        ls_stop: undefined,
        ls_provider: model.getName(),
      },
      name: "my_model",
      data: { chunk: new AIMessageChunk({ id: anyString, content: "R" }) },
    },
    {
      event: "on_chat_model_stream",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_chain", "my_model"]),
      metadata: {
        a: "b",
        foo: "bar",
        ls_model_type: "chat",
        ls_stop: undefined,
        ls_provider: model.getName(),
      },
      name: "my_model",
      data: { chunk: new AIMessageChunk({ id: anyString, content: "O" }) },
    },
    {
      event: "on_chat_model_stream",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_chain", "my_model"]),
      metadata: {
        a: "b",
        foo: "bar",
        ls_model_type: "chat",
        ls_stop: undefined,
        ls_provider: model.getName(),
      },
      name: "my_model",
      data: { chunk: new AIMessageChunk({ id: anyString, content: "A" }) },
    },
    {
      event: "on_chat_model_stream",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_chain", "my_model"]),
      metadata: {
        a: "b",
        foo: "bar",
        ls_model_type: "chat",
        ls_stop: undefined,
        ls_provider: model.getName(),
      },
      name: "my_model",
      data: { chunk: new AIMessageChunk({ id: anyString, content: "R" }) },
    },
    {
      event: "on_chat_model_end",
      name: "my_model",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_model", "my_chain"]),
      metadata: {
        foo: "bar",
        a: "b",
        ls_model_type: "chat",
        ls_stop: undefined,
        ls_provider: model.getName(),
      },
      data: {
        input: {
          messages: [
            [new SystemMessage("You are Godzilla"), new HumanMessage("hello")],
          ],
        },
        output: new AIMessageChunk({ id: anyString, content: "ROAR" }),
      },
    },
    {
      event: "on_chain_stream",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["seq:step:2", "my_chain"]),
      metadata: {
        foo: "bar",
      },
      name: "RunnableLambda",
      data: { chunk: new AIMessageChunk({ id: anyString, content: "ROAR" }) },
    },
    {
      event: "on_chain_stream",
      run_id: expect.any(String),
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
      name: "my_chain",
      data: { chunk: new AIMessageChunk({ id: anyString, content: "ROAR" }) },
    },
    {
      event: "on_chain_end",
      name: "RunnableLambda",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["seq:step:2", "my_chain"]),
      metadata: {
        foo: "bar",
      },
      data: {
        input: await template.invoke({ question: "hello" }),
        output: new AIMessageChunk({ id: anyString, content: "ROAR" }),
      },
    },
    {
      event: "on_chain_end",
      name: "my_chain",
      run_id: expect.any(String),
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
      data: {
        output: new AIMessageChunk({ id: anyString, content: "ROAR" }),
      },
    },
  ]);
});

test("Chat model that doesn't support streaming, but is invoked, should emit one on_stream event", async () => {
  const template = ChatPromptTemplate.fromMessages([
    ["system", "You are Godzilla"],
    ["human", "{question}"],
  ]).withConfig({
    runName: "my_template",
    tags: ["my_template"],
  });
  const model = new FakeChatModel({}).withConfig({
    metadata: { a: "b" },
    tags: ["my_model"],
    runName: "my_model",
  });
  const chain = template
    .pipe(async (val, config) => {
      const result = await model.invoke(val, config);
      return result;
    })
    .withConfig({
      metadata: { foo: "bar" },
      tags: ["my_chain"],
      runName: "my_chain",
    });
  const events = [];
  const eventStream = await chain.streamEvents(
    { question: "hello" },
    { version: "v2" }
  );
  for await (const event of eventStream) {
    events.push(event);
  }

  const anyString = expect.any(String) as unknown as string;
  expect(events).toEqual([
    {
      run_id: expect.any(String),
      event: "on_chain_start",
      name: "my_chain",
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
      data: {
        input: {
          question: "hello",
        },
      },
    },
    {
      data: { input: { question: "hello" } },
      event: "on_prompt_start",
      metadata: { foo: "bar" },
      name: "my_template",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_chain", "seq:step:1", "my_template"]),
    },
    {
      event: "on_prompt_end",
      name: "my_template",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["seq:step:1", "my_template", "my_chain"]),
      metadata: {
        foo: "bar",
      },
      data: {
        input: {
          question: "hello",
        },
        output: await template.invoke({ question: "hello" }),
      },
    },
    {
      event: "on_chain_start",
      data: {},
      name: "RunnableLambda",
      tags: ["seq:step:2", "my_chain"],
      run_id: expect.any(String),
      metadata: {
        foo: "bar",
      },
    },
    {
      event: "on_chat_model_start",
      name: "my_model",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_model", "my_chain"]),
      metadata: {
        foo: "bar",
        a: "b",
        ls_model_type: "chat",
        ls_stop: undefined,
        ls_provider: model.getName(),
      },
      data: {
        input: {
          messages: [
            [new SystemMessage("You are Godzilla"), new HumanMessage("hello")],
          ],
        },
      },
    },
    {
      event: "on_chat_model_stream",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_chain", "my_model"]),
      metadata: {
        a: "b",
        foo: "bar",
        ls_model_type: "chat",
        ls_stop: undefined,
        ls_provider: model.getName(),
      },
      name: "my_model",
      data: {
        chunk: new AIMessageChunk({
          id: anyString,
          content: "You are Godzilla\nhello",
        }),
      },
    },
    {
      event: "on_chat_model_end",
      name: "my_model",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["my_model", "my_chain"]),
      metadata: {
        foo: "bar",
        a: "b",
        ls_model_type: "chat",
        ls_stop: undefined,
        ls_provider: model.getName(),
      },
      data: {
        input: {
          messages: [
            [new SystemMessage("You are Godzilla"), new HumanMessage("hello")],
          ],
        },
        output: new AIMessage({
          id: anyString,
          content: "You are Godzilla\nhello",
        }),
      },
    },
    {
      event: "on_chain_stream",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["seq:step:2", "my_chain"]),
      metadata: {
        foo: "bar",
      },
      name: "RunnableLambda",
      data: {
        chunk: new AIMessage({
          id: anyString,
          content: "You are Godzilla\nhello",
        }),
      },
    },
    {
      event: "on_chain_stream",
      run_id: expect.any(String),
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
      name: "my_chain",
      data: {
        chunk: new AIMessage({
          id: anyString,
          content: "You are Godzilla\nhello",
        }),
      },
    },
    {
      event: "on_chain_end",
      name: "RunnableLambda",
      run_id: expect.any(String),
      tags: expect.arrayContaining(["seq:step:2", "my_chain"]),
      metadata: {
        foo: "bar",
      },
      data: {
        input: await template.invoke({ question: "hello" }),
        output: new AIMessage({
          id: anyString,
          content: "You are Godzilla\nhello",
        }),
      },
    },
    {
      event: "on_chain_end",
      name: "my_chain",
      run_id: expect.any(String),
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
      data: {
        output: new AIMessage({
          id: anyString,
          content: "You are Godzilla\nhello",
        }),
      },
    },
  ]);
});

test("LLM that supports streaming, but is invoked, should still emit on_stream events", async () => {
  const template = PromptTemplate.fromTemplate(
    `You are Godzilla\n{question}`
  ).withConfig({
    runName: "my_template",
    tags: ["my_template"],
  });
  const model = new FakeStreamingLLM({
    responses: ["ROAR"],
  }).withConfig({
    metadata: { a: "b" },
    tags: ["my_model"],
    runName: "my_model",
  });
  const chain = template
    .pipe(async (val, config) => {
      const result = await model.invoke(val, config);
      return result;
    })
    .withConfig({
      metadata: { foo: "bar" },
      tags: ["my_chain"],
      runName: "my_chain",
    });
  const events = [];
  const eventStream = await chain.streamEvents(
    { question: "hello" },
    { version: "v2" }
  );
  for await (const event of eventStream) {
    events.push(event);
  }
  expect(events).toEqual([
    {
      event: "on_chain_start",
      data: {
        input: {
          question: "hello",
        },
      },
      name: "my_chain",
      tags: ["my_chain"],
      run_id: expect.any(String),
      metadata: {
        foo: "bar",
      },
    },
    {
      event: "on_prompt_start",
      data: {
        input: {
          question: "hello",
        },
      },
      name: "my_template",
      tags: ["seq:step:1", "my_template", "my_chain"],
      run_id: expect.any(String),
      metadata: {
        foo: "bar",
      },
    },
    {
      event: "on_prompt_end",
      data: {
        output: await template.invoke({ question: "hello" }),
        input: {
          question: "hello",
        },
      },
      run_id: expect.any(String),
      name: "my_template",
      tags: ["seq:step:1", "my_template", "my_chain"],
      metadata: {
        foo: "bar",
      },
    },
    {
      event: "on_chain_start",
      data: {},
      name: "RunnableLambda",
      tags: ["seq:step:2", "my_chain"],
      run_id: expect.any(String),
      metadata: {
        foo: "bar",
      },
    },
    {
      event: "on_llm_start",
      data: {
        input: {
          prompts: ["You are Godzilla\nhello"],
        },
      },
      name: "my_model",
      tags: ["my_model", "my_chain"],
      run_id: expect.any(String),
      metadata: {
        foo: "bar",
        a: "b",
      },
    },
    {
      event: "on_llm_stream",
      data: {
        chunk: new GenerationChunk({
          text: "R",
        }),
      },
      run_id: expect.any(String),
      name: "my_model",
      tags: ["my_model", "my_chain"],
      metadata: {
        foo: "bar",
        a: "b",
      },
    },
    {
      event: "on_llm_stream",
      data: {
        chunk: new GenerationChunk({
          text: "O",
        }),
      },
      run_id: expect.any(String),
      name: "my_model",
      tags: ["my_model", "my_chain"],
      metadata: {
        foo: "bar",
        a: "b",
      },
    },
    {
      event: "on_llm_stream",
      data: {
        chunk: new GenerationChunk({
          text: "A",
        }),
      },
      run_id: expect.any(String),
      name: "my_model",
      tags: ["my_model", "my_chain"],
      metadata: {
        foo: "bar",
        a: "b",
      },
    },
    {
      event: "on_llm_stream",
      data: {
        chunk: new GenerationChunk({
          text: "R",
        }),
      },
      run_id: expect.any(String),
      name: "my_model",
      tags: ["my_model", "my_chain"],
      metadata: {
        foo: "bar",
        a: "b",
      },
    },
    {
      event: "on_llm_end",
      data: {
        output: {
          generations: [
            [
              {
                text: "ROAR",
                generationInfo: {},
              },
            ],
          ],
          llmOutput: {},
        },
        input: {
          prompts: ["You are Godzilla\nhello"],
        },
      },
      run_id: expect.any(String),
      name: "my_model",
      tags: ["my_model", "my_chain"],
      metadata: {
        foo: "bar",
        a: "b",
      },
    },
    {
      event: "on_chain_stream",
      run_id: expect.any(String),
      name: "RunnableLambda",
      tags: ["seq:step:2", "my_chain"],
      metadata: {
        foo: "bar",
      },
      data: {
        chunk: "ROAR",
      },
    },
    {
      event: "on_chain_stream",
      run_id: expect.any(String),
      name: "my_chain",
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
      data: {
        chunk: "ROAR",
      },
    },
    {
      event: "on_chain_end",
      data: {
        output: "ROAR",
        input: await template.invoke({ question: "hello" }),
      },
      run_id: expect.any(String),
      name: "RunnableLambda",
      tags: ["seq:step:2", "my_chain"],
      metadata: {
        foo: "bar",
      },
    },
    {
      event: "on_chain_end",
      data: {
        output: "ROAR",
      },
      run_id: expect.any(String),
      name: "my_chain",
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
    },
  ]);
});

test("LLM that doesn't support streaming, but is invoked, should emit one on_stream event", async () => {
  const template = PromptTemplate.fromTemplate(
    `You are Godzilla\n{question}`
  ).withConfig({
    runName: "my_template",
    tags: ["my_template"],
  });
  const model = new FakeLLM({}).withConfig({
    metadata: { a: "b" },
    tags: ["my_model"],
    runName: "my_model",
  });
  const chain = template
    .pipe(async (val, config) => {
      const result = await model.invoke(val, config);
      return result;
    })
    .withConfig({
      metadata: { foo: "bar" },
      tags: ["my_chain"],
      runName: "my_chain",
    });
  const events = [];
  const eventStream = await chain.streamEvents(
    { question: "hello" },
    { version: "v2" }
  );
  for await (const event of eventStream) {
    events.push(event);
  }
  expect(events).toEqual([
    {
      event: "on_chain_start",
      data: {
        input: {
          question: "hello",
        },
      },
      name: "my_chain",
      tags: ["my_chain"],
      run_id: expect.any(String),
      metadata: {
        foo: "bar",
      },
    },
    {
      event: "on_prompt_start",
      data: {
        input: {
          question: "hello",
        },
      },
      name: "my_template",
      tags: ["seq:step:1", "my_template", "my_chain"],
      run_id: expect.any(String),
      metadata: {
        foo: "bar",
      },
    },
    {
      event: "on_prompt_end",
      data: {
        output: await template.invoke({ question: "hello" }),
        input: {
          question: "hello",
        },
      },
      run_id: expect.any(String),
      name: "my_template",
      tags: ["seq:step:1", "my_template", "my_chain"],
      metadata: {
        foo: "bar",
      },
    },
    {
      event: "on_chain_start",
      data: {},
      name: "RunnableLambda",
      tags: ["seq:step:2", "my_chain"],
      run_id: expect.any(String),
      metadata: {
        foo: "bar",
      },
    },
    {
      event: "on_llm_start",
      data: {
        input: {
          prompts: ["You are Godzilla\nhello"],
        },
      },
      name: "my_model",
      tags: ["my_model", "my_chain"],
      run_id: expect.any(String),
      metadata: {
        foo: "bar",
        a: "b",
      },
    },
    {
      event: "on_llm_stream",
      data: {
        chunk: new GenerationChunk({
          text: "You are Godzilla\nhello",
        }),
      },
      run_id: expect.any(String),
      name: "my_model",
      tags: ["my_model", "my_chain"],
      metadata: {
        foo: "bar",
        a: "b",
      },
    },
    {
      event: "on_llm_end",
      data: {
        output: {
          generations: [
            [
              {
                text: "You are Godzilla\nhello",
                generationInfo: undefined,
              },
            ],
          ],
          llmOutput: {},
        },
        input: {
          prompts: ["You are Godzilla\nhello"],
        },
      },
      run_id: expect.any(String),
      name: "my_model",
      tags: ["my_model", "my_chain"],
      metadata: {
        foo: "bar",
        a: "b",
      },
    },
    {
      event: "on_chain_stream",
      run_id: expect.any(String),
      name: "RunnableLambda",
      tags: ["seq:step:2", "my_chain"],
      metadata: {
        foo: "bar",
      },
      data: {
        chunk: "You are Godzilla\nhello",
      },
    },
    {
      event: "on_chain_stream",
      run_id: expect.any(String),
      name: "my_chain",
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
      data: {
        chunk: "You are Godzilla\nhello",
      },
    },
    {
      event: "on_chain_end",
      data: {
        output: "You are Godzilla\nhello",
        input: await template.invoke({ question: "hello" }),
      },
      run_id: expect.any(String),
      name: "RunnableLambda",
      tags: ["seq:step:2", "my_chain"],
      metadata: {
        foo: "bar",
      },
    },
    {
      event: "on_chain_end",
      data: {
        output: "You are Godzilla\nhello",
      },
      run_id: expect.any(String),
      name: "my_chain",
      tags: ["my_chain"],
      metadata: {
        foo: "bar",
      },
    },
  ]);
});

test("Runnable streamEvents method with simple tools", async () => {
  const tool = new DynamicTool({
    func: async () => "hello",
    name: "parameterless",
    description: "A tool that does nothing",
  });
  const events = [];
  const eventStream = await tool.streamEvents({}, { version: "v2" });
  for await (const event of eventStream) {
    events.push(event);
  }

  expect(events).toEqual([
    {
      data: { input: {} },
      event: "on_tool_start",
      metadata: {},
      name: "parameterless",
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { output: "hello" },
      event: "on_tool_end",
      metadata: {},
      name: "parameterless",
      run_id: expect.any(String),
      tags: [],
    },
  ]);

  const toolWithParams = new DynamicStructuredTool({
    func: async (params: { x: number; y: string }) =>
      JSON.stringify({ x: params.x, y: params.y }),
    schema: z.object({
      x: z.number(),
      y: z.string(),
    }),
    name: "with_parameters",
    description: "A tool that does nothing",
  });
  const events2 = [];
  const eventStream2 = await toolWithParams.streamEvents(
    { x: 1, y: "2" },
    { version: "v2" }
  );
  for await (const event of eventStream2) {
    events2.push(event);
  }
  expect(events2).toEqual([
    {
      data: { input: { x: 1, y: "2" } },
      event: "on_tool_start",
      metadata: {},
      name: "with_parameters",
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { output: JSON.stringify({ x: 1, y: "2" }) },
      event: "on_tool_end",
      metadata: {},
      name: "with_parameters",
      run_id: expect.any(String),
      tags: [],
    },
  ]);
});

test("Runnable methods with a custom event", async () => {
  const lambda = RunnableLambda.from(
    async (params: { x: number; y: string }, config) => {
      await dispatchCustomEvent("testEvent", { someval: "test" }, config);
      await dispatchCustomEvent("testEvent", { someval: "test2" }, config);
      return JSON.stringify({ x: params.x, y: params.y });
    }
  );
  // Invoke shouldn't fail
  const res = await lambda.invoke({ x: 1, y: "2" });
  expect(res).toEqual(JSON.stringify({ x: 1, y: "2" }));
  const events = [];
  const eventStream = await lambda.streamEvents(
    { x: 1, y: "2" },
    { version: "v2" }
  );
  for await (const event of eventStream) {
    events.push(event);
  }
  expect(events).toEqual([
    {
      event: "on_chain_start",
      data: { input: { x: 1, y: "2" } },
      name: "RunnableLambda",
      tags: [],
      run_id: expect.any(String),
      metadata: {},
    },
    {
      event: "on_custom_event",
      run_id: expect.any(String),
      name: "testEvent",
      tags: [],
      metadata: {},
      data: { someval: "test" },
    },
    {
      event: "on_custom_event",
      run_id: expect.any(String),
      name: "testEvent",
      tags: [],
      metadata: {},
      data: { someval: "test2" },
    },
    {
      event: "on_chain_stream",
      run_id: expect.any(String),
      name: "RunnableLambda",
      tags: [],
      metadata: {},
      data: { chunk: '{"x":1,"y":"2"}' },
    },
    {
      event: "on_chain_end",
      data: { output: '{"x":1,"y":"2"}' },
      run_id: expect.any(String),
      name: "RunnableLambda",
      tags: [],
      metadata: {},
    },
  ]);
});

test("Custom event inside a custom tool", async () => {
  const customTool = tool(
    async (params: { x: number; y: string }, config) => {
      await dispatchCustomEvent("testEvent", { someval: "test" }, config);
      await dispatchCustomEvent("testEvent", { someval: "test2" }, config);
      return JSON.stringify({ x: params.x, y: params.y });
    },
    {
      schema: z.object({ x: z.number(), y: z.string() }),
      name: "testtool",
    }
  );
  const events = [];
  const eventStream = await customTool.streamEvents(
    { x: 1, y: "2" },
    { version: "v2" }
  );
  for await (const event of eventStream) {
    events.push(event);
  }
  expect(events).toEqual([
    {
      event: "on_tool_start",
      data: { input: { x: 1, y: "2" } },
      name: "testtool",
      tags: [],
      run_id: expect.any(String),
      metadata: {},
    },
    {
      event: "on_custom_event",
      run_id: expect.any(String),
      name: "testEvent",
      tags: [],
      metadata: {},
      data: { someval: "test" },
    },
    {
      event: "on_custom_event",
      run_id: expect.any(String),
      name: "testEvent",
      tags: [],
      metadata: {},
      data: { someval: "test2" },
    },
    {
      event: "on_tool_end",
      data: { output: '{"x":1,"y":"2"}' },
      run_id: expect.any(String),
      name: "testtool",
      tags: [],
      metadata: {},
    },
  ]);
});

test("Runnable streamEvents method with tools that return objects", async () => {
  const adderFunc = (_params: { x: number; y: number }) => {
    return JSON.stringify({ sum: 3 });
  };
  const parameterlessTool = tool(adderFunc, {
    name: "parameterless",
  });
  const events = [];
  const eventStream = parameterlessTool.streamEvents({}, { version: "v2" });
  for await (const event of eventStream) {
    events.push(event);
  }

  expect(events).toEqual([
    {
      data: { input: {} },
      event: "on_tool_start",
      metadata: {},
      name: "parameterless",
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: {
        output: JSON.stringify({ sum: 3 }),
      },
      event: "on_tool_end",
      metadata: {},
      name: "parameterless",
      run_id: expect.any(String),
      tags: [],
    },
  ]);

  const adderTool = tool(adderFunc, {
    name: "with_parameters",
    description: "A tool that does nothing",
    schema: z.object({
      x: z.number(),
      y: z.number(),
    }),
  });
  const events2 = [];
  const eventStream2 = adderTool.streamEvents(
    { x: 1, y: 2 },
    { version: "v2" }
  );
  for await (const event of eventStream2) {
    events2.push(event);
  }
  expect(events2).toEqual([
    {
      data: { input: { x: 1, y: 2 } },
      event: "on_tool_start",
      metadata: {},
      name: "with_parameters",
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: { output: JSON.stringify({ sum: 3 }) },
      event: "on_tool_end",
      metadata: {},
      name: "with_parameters",
      run_id: expect.any(String),
      tags: [],
    },
  ]);
});

test("Runnable streamEvents method with a retriever", async () => {
  const retriever = new FakeRetriever({
    output: [
      new Document({ pageContent: "hello world!", metadata: { foo: "bar" } }),
      new Document({
        pageContent: "goodbye world!",
        metadata: { food: "spare" },
      }),
    ],
  });
  const events = [];
  const eventStream = await retriever.streamEvents("hello", {
    version: "v2",
  });
  for await (const event of eventStream) {
    events.push(event);
  }
  expect(events).toEqual([
    {
      data: {
        input: "hello",
      },
      event: "on_retriever_start",
      metadata: {},
      name: "FakeRetriever",
      run_id: expect.any(String),
      tags: [],
    },
    {
      data: {
        output: [
          new Document({
            pageContent: "hello world!",
            metadata: { foo: "bar" },
          }),
          new Document({
            pageContent: "goodbye world!",
            metadata: { food: "spare" },
          }),
        ],
      },
      event: "on_retriever_end",
      metadata: {},
      name: "FakeRetriever",
      run_id: expect.any(String),
      tags: [],
    },
  ]);
});

test("Runnable streamEvents method with text/event-stream encoding", async () => {
  const chain = RunnableLambda.from(reverse).withConfig({
    runName: "reverse",
  });
  const events = [];
  const eventStream = await chain.streamEvents("hello", {
    version: "v2",
    encoding: "text/event-stream",
    runId: "1234",
  });
  for await (const event of eventStream) {
    events.push(event);
  }
  const decoder = new TextDecoder();
  expect(events.length).toEqual(4);
  const dataEvents = events
    .slice(0, 3)
    .map((event) => decoder.decode(event).split("event: data\ndata: ")[1]);
  const expectedPayloads = [
    {
      data: { input: "hello" },
      event: "on_chain_start",
      metadata: {},
      name: "reverse",
      run_id: "1234",
      tags: [],
    },
    {
      data: { chunk: "olleh" },
      event: "on_chain_stream",
      metadata: {},
      name: "reverse",
      run_id: "1234",
      tags: [],
    },
    {
      data: { output: "olleh" },
      event: "on_chain_end",
      metadata: {},
      name: "reverse",
      run_id: "1234",
      tags: [],
    },
  ];
  for (let i = 0; i < dataEvents.length; i += 1) {
    expect(dataEvents[i].endsWith("\n\n")).toBe(true);
    expect(JSON.parse(dataEvents[i].replace("\n\n", ""))).toEqual(
      expectedPayloads[i]
    );
  }

  expect(decoder.decode(events[3])).toEqual("event: end\n\n");
});

test("Runnable streamEvents method should respect passed signal", async () => {
  const r = RunnableLambda.from(reverse);

  const chain = r
    .withConfig({ runName: "1" })
    .pipe(r.withConfig({ runName: "2" }))
    .pipe(r.withConfig({ runName: "3" }));

  const controller = new AbortController();
  const eventStream = await chain.streamEvents("hello", {
    version: "v2",
    signal: controller.signal,
  });
  await expect(async () => {
    for await (const _ of eventStream) {
      // Abort after the first chunk
      controller.abort();
    }
  }).rejects.toThrowError();
});

test("streamEvents method handles errors", async () => {
  let caughtError: unknown;
  const model = new FakeListChatModel({
    responses: ["abc"],
  });

  try {
    // eslint-disable-next-line no-unreachable-loop
    for await (const _ of model.streamEvents("Hello! Tell me about yourself.", {
      version: "v2",
    })) {
      throw new Error("should catch this error");
    }
  } catch (e) {
    caughtError = e;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((caughtError as any)?.message).toEqual("should catch this error");
});
