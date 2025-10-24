/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-process-env */
/* eslint-disable no-promise-executor-return */

import {
  jest,
  test,
  beforeEach,
  afterEach,
  afterAll,
  expect,
} from "@jest/globals";
import { traceable } from "langsmith/traceable";
import { Client } from "langsmith";

import { RunnableLambda } from "../../runnables/base.js";
import { BaseMessage, HumanMessage } from "../../messages/index.js";
import { setDefaultLangChainClientSingleton } from "../../singletons/tracer.js";
import { LangChainTracer } from "../tracer_langchain.js";
import { awaitAllCallbacks } from "../../singletons/callbacks.js";

let fetchMock: any;

const originalTracingEnvValue = process.env.LANGCHAIN_TRACING_V2;

const client = new Client({
  autoBatchTracing: false,
});

const decoder = new TextDecoder();

beforeEach(() => {
  fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
    Promise.resolve({
      ok: true,
      text: () => "",
      json: () => {
        return {};
      },
    } as any)
  );
  setDefaultLangChainClientSingleton(client);
  process.env.LANGCHAIN_TRACING_V2 = "true";
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env.LANGCHAIN_TRACING_V2 = originalTracingEnvValue;
});

test.each(["true", "false"])(
  "traceables nested within runnables with background callbacks %s",
  async (value) => {
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = value;

    const aiGreet = traceable(
      async (msg: BaseMessage, name = "world") => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return msg.content + name;
      },
      { name: "aiGreet", tracingEnabled: true, client }
    );

    const root = RunnableLambda.from(async (messages: BaseMessage[]) => {
      const lastMsg = messages.at(-1) as HumanMessage;
      const greetOne = await aiGreet(lastMsg, "David");

      return [greetOne];
    });

    await root.invoke([new HumanMessage({ content: "Hello!" })]);

    const relevantCalls = fetchMock.mock.calls.filter((call: any) => {
      return call[0].startsWith("https://api.smith.langchain.com/runs");
    });

    expect(relevantCalls.length).toEqual(4);
    const firstCallParams = JSON.parse(
      decoder.decode((relevantCalls[0][1] as any).body)
    );
    const secondCallParams = JSON.parse(
      decoder.decode((relevantCalls[1][1] as any).body)
    );
    const thirdCallParams = JSON.parse(
      decoder.decode((relevantCalls[2][1] as any).body)
    );
    const fourthCallParams = JSON.parse(
      decoder.decode((relevantCalls[3][1] as any).body)
    );
    expect(firstCallParams).toMatchObject({
      id: firstCallParams.id,
      name: "RunnableLambda",
      start_time: expect.any(String),
      serialized: {
        lc: 1,
        type: "not_implemented",
        id: ["langchain_core", "runnables", "RunnableLambda"],
      },
      events: [{ name: "start", time: expect.any(String) }],
      inputs: {
        input: [
          {
            lc: 1,
            type: "constructor",
            id: ["langchain_core", "messages", "HumanMessage"],
            kwargs: {
              content: "Hello!",
              additional_kwargs: {},
              response_metadata: {},
            },
          },
        ],
      },
      run_type: "chain",
      extra: expect.any(Object),
      tags: [],
      trace_id: firstCallParams.id,
      dotted_order: expect.any(String),
    });
    expect(secondCallParams).toMatchObject({
      id: expect.any(String),
      name: "aiGreet",
      start_time: expect.any(String),
      run_type: "chain",
      extra: expect.any(Object),
      serialized: {},
      inputs: {
        args: [
          {
            lc: 1,
            type: "constructor",
            id: ["langchain_core", "messages", "HumanMessage"],
            kwargs: {
              content: "Hello!",
              additional_kwargs: {},
              response_metadata: {},
            },
          },
          "David",
        ],
      },
      child_runs: [],
      parent_run_id: firstCallParams.id,
      trace_id: firstCallParams.id,
      dotted_order: expect.stringContaining(`${firstCallParams.dotted_order}.`),
      tags: [],
    });
    expect(thirdCallParams).toMatchObject({
      end_time: expect.any(Number),
      outputs: { outputs: "Hello!David" },
      parent_run_id: firstCallParams.id,
      extra: expect.any(Object),
      dotted_order: secondCallParams.dotted_order,
      trace_id: firstCallParams.id,
      tags: [],
    });
    expect(fourthCallParams).toMatchObject({
      end_time: expect.any(Number),
      outputs: { output: ["Hello!David"] },
      events: [
        { name: "start", time: expect.any(String) },
        { name: "end", time: expect.any(String) },
      ],
      trace_id: firstCallParams.id,
      dotted_order: firstCallParams.dotted_order,
    });
  }
);

test.each(["true", "false"])(
  "traceables nested within runnables with a context var set and with background callbacks %s",
  async (value) => {
    const { setContextVariable, getContextVariable } = await import(
      "../../context.js"
    );
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = value;

    setContextVariable("foo", "bar");
    const aiGreet = traceable(
      async (msg: BaseMessage, name = "world") => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(getContextVariable("foo")).toEqual("baz");
        return msg.content + name;
      },
      { name: "aiGreet", tracingEnabled: true, client }
    );

    const root = RunnableLambda.from(async (messages: BaseMessage[]) => {
      const lastMsg = messages.at(-1) as HumanMessage;
      expect(getContextVariable("foo")).toEqual("bar");
      setContextVariable("foo", "baz");
      const greetOne = await aiGreet(lastMsg, "David");

      return [greetOne];
    });

    await root.invoke([new HumanMessage({ content: "Hello!" })]);

    const relevantCalls = fetchMock.mock.calls.filter((call: any) => {
      return call[0].startsWith("https://api.smith.langchain.com/runs");
    });

    expect(relevantCalls.length).toEqual(4);
    const firstCallParams = JSON.parse(
      decoder.decode((relevantCalls[0][1] as any).body)
    );
    const secondCallParams = JSON.parse(
      decoder.decode((relevantCalls[1][1] as any).body)
    );
    const thirdCallParams = JSON.parse(
      decoder.decode((relevantCalls[2][1] as any).body)
    );
    const fourthCallParams = JSON.parse(
      decoder.decode((relevantCalls[3][1] as any).body)
    );
    expect(firstCallParams).toMatchObject({
      id: firstCallParams.id,
      name: "RunnableLambda",
      start_time: expect.any(String),
      serialized: {
        lc: 1,
        type: "not_implemented",
        id: ["langchain_core", "runnables", "RunnableLambda"],
      },
      events: [{ name: "start", time: expect.any(String) }],
      inputs: {
        input: [
          {
            lc: 1,
            type: "constructor",
            id: ["langchain_core", "messages", "HumanMessage"],
            kwargs: {
              content: "Hello!",
              additional_kwargs: {},
              response_metadata: {},
            },
          },
        ],
      },
      run_type: "chain",
      extra: expect.any(Object),
      tags: [],
      trace_id: firstCallParams.id,
      dotted_order: expect.any(String),
    });
    expect(secondCallParams).toMatchObject({
      id: expect.any(String),
      name: "aiGreet",
      start_time: expect.any(String),
      run_type: "chain",
      extra: expect.any(Object),
      serialized: {},
      inputs: {
        args: [
          {
            lc: 1,
            type: "constructor",
            id: ["langchain_core", "messages", "HumanMessage"],
            kwargs: {
              content: "Hello!",
              additional_kwargs: {},
              response_metadata: {},
            },
          },
          "David",
        ],
      },
      child_runs: [],
      parent_run_id: firstCallParams.id,
      trace_id: firstCallParams.id,
      dotted_order: expect.stringContaining(`${firstCallParams.dotted_order}.`),
      tags: [],
    });
    expect(thirdCallParams).toMatchObject({
      end_time: expect.any(Number),
      outputs: { outputs: "Hello!David" },
      parent_run_id: firstCallParams.id,
      extra: expect.any(Object),
      dotted_order: secondCallParams.dotted_order,
      trace_id: firstCallParams.id,
      tags: [],
    });
    expect(fourthCallParams).toMatchObject({
      end_time: expect.any(Number),
      outputs: { output: ["Hello!David"] },
      events: [
        { name: "start", time: expect.any(String) },
        { name: "end", time: expect.any(String) },
      ],
      trace_id: firstCallParams.id,
      dotted_order: firstCallParams.dotted_order,
    });
  }
);

test.each(["true", "false"])(
  "streaming traceables nested within runnables with background callbacks %s",
  async (value) => {
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = value;

    const aiGreet = traceable(
      async function* (msg: BaseMessage, name = "world") {
        const res = msg.content + name;
        await new Promise((resolve) => setTimeout(resolve, 300));
        for (const letter of res.split("")) {
          yield letter;
        }
      },
      { name: "aiGreet" }
    );

    const root = RunnableLambda.from(async function* (messages: BaseMessage[]) {
      const lastMsg = messages.at(-1) as HumanMessage;
      yield* aiGreet(lastMsg, "David");
    });

    const stream = await root.stream([new HumanMessage({ content: "Hello!" })]);

    for await (const _ of stream) {
      // Just consume iterator
    }

    const relevantCalls = fetchMock.mock.calls.filter((call: any) => {
      return call[0].startsWith("https://api.smith.langchain.com/runs");
    });

    expect(relevantCalls.length).toEqual(4);
    const firstCallParams = JSON.parse(
      decoder.decode((relevantCalls[0][1] as any).body)
    );
    const secondCallParams = JSON.parse(
      decoder.decode((relevantCalls[1][1] as any).body)
    );
    const thirdCallParams = JSON.parse(
      decoder.decode((relevantCalls[2][1] as any).body)
    );
    const fourthCallParams = JSON.parse(
      decoder.decode((relevantCalls[3][1] as any).body)
    );
    expect(firstCallParams).toMatchObject({
      id: firstCallParams.id,
      name: "RunnableLambda",
      start_time: expect.any(String),
      serialized: {
        lc: 1,
        type: "not_implemented",
        id: ["langchain_core", "runnables", "RunnableLambda"],
      },
      events: [{ name: "start", time: expect.any(String) }],
      inputs: {
        input: "",
      },
      run_type: "chain",
      extra: expect.any(Object),
      tags: [],
      trace_id: firstCallParams.id,
      dotted_order: expect.any(String),
    });
    expect(secondCallParams).toMatchObject({
      id: expect.any(String),
      name: "aiGreet",
      start_time: expect.any(String),
      run_type: "chain",
      extra: expect.any(Object),
      serialized: {},
      inputs: {
        args: [
          {
            lc: 1,
            type: "constructor",
            id: ["langchain_core", "messages", "HumanMessage"],
            kwargs: {
              content: "Hello!",
              additional_kwargs: {},
              response_metadata: {},
            },
          },
          "David",
        ],
      },
      child_runs: [],
      parent_run_id: firstCallParams.id,
      trace_id: firstCallParams.id,
      dotted_order: expect.stringContaining(`${firstCallParams.dotted_order}.`),
      tags: [],
    });
    expect(thirdCallParams).toMatchObject({
      end_time: expect.any(Number),
      outputs: {
        outputs: ["H", "e", "l", "l", "o", "!", "D", "a", "v", "i", "d"],
      },
      parent_run_id: firstCallParams.id,
      extra: expect.any(Object),
      dotted_order: secondCallParams.dotted_order,
      trace_id: firstCallParams.id,
      tags: [],
    });
    expect(fourthCallParams).toMatchObject({
      end_time: expect.any(Number),
      outputs: { output: "Hello!David" },
      events: [
        { name: "start", time: expect.any(String) },
        { name: "end", time: expect.any(String) },
      ],
      trace_id: firstCallParams.id,
      dotted_order: firstCallParams.dotted_order,
    });
  }
);

test.each(["true", "false"])(
  "runnables nested within traceables with background callbacks %s",
  async (value) => {
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = value;

    const nested = RunnableLambda.from(async (messages: BaseMessage[]) => {
      const lastMsg = messages.at(-1) as HumanMessage;
      await new Promise((resolve) => setTimeout(resolve, 300));
      return [lastMsg.content];
    });

    const aiGreet = traceable(
      async (msg: BaseMessage, name = "world") => {
        const contents = await nested.invoke([msg]);
        return contents[0] + name;
      },
      { name: "aiGreet", tracingEnabled: true, client }
    );

    await aiGreet(new HumanMessage({ content: "Hello!" }), "mitochondria");

    const relevantCalls = fetchMock.mock.calls.filter((call: any) => {
      return call[0].startsWith("https://api.smith.langchain.com/runs");
    });

    expect(relevantCalls.length).toEqual(4);
    const firstCallParams = JSON.parse(
      decoder.decode((relevantCalls[0][1] as any).body)
    );
    const secondCallParams = JSON.parse(
      decoder.decode((relevantCalls[1][1] as any).body)
    );
    const thirdCallParams = JSON.parse(
      decoder.decode((relevantCalls[2][1] as any).body)
    );
    const fourthCallParams = JSON.parse(
      decoder.decode((relevantCalls[3][1] as any).body)
    );
    expect(firstCallParams).toMatchObject({
      id: firstCallParams.id,
      name: "aiGreet",
      start_time: expect.any(String),
      run_type: "chain",
      extra: expect.any(Object),
      serialized: {},
      inputs: {
        args: [
          {
            lc: 1,
            type: "constructor",
            id: ["langchain_core", "messages", "HumanMessage"],
            kwargs: {
              content: "Hello!",
              additional_kwargs: {},
              response_metadata: {},
            },
          },
          "mitochondria",
        ],
      },
      child_runs: [],
      trace_id: firstCallParams.id,
      dotted_order: firstCallParams.dotted_order,
      tags: [],
    });
    expect(secondCallParams).toMatchObject({
      id: secondCallParams.id,
      name: "RunnableLambda",
      parent_run_id: firstCallParams.id,
      start_time: expect.any(String),
      serialized: {
        lc: 1,
        type: "not_implemented",
        id: ["langchain_core", "runnables", "RunnableLambda"],
      },
      events: [{ name: "start", time: expect.any(String) }],
      inputs: {
        input: [
          {
            lc: 1,
            type: "constructor",
            id: ["langchain_core", "messages", "HumanMessage"],
            kwargs: {
              content: "Hello!",
              additional_kwargs: {},
              response_metadata: {},
            },
          },
        ],
      },
      run_type: "chain",
      extra: expect.any(Object),
      tags: [],
      trace_id: firstCallParams.id,
      dotted_order: expect.stringContaining(`${firstCallParams.dotted_order}.`),
    });
    expect(thirdCallParams).toMatchObject({
      end_time: expect.any(Number),
      outputs: { output: ["Hello!"] },
      events: [
        { name: "start", time: expect.any(String) },
        { name: "end", time: expect.any(String) },
      ],
      trace_id: firstCallParams.id,
      dotted_order: expect.stringContaining(`${firstCallParams.dotted_order}.`),
      parent_run_id: firstCallParams.id,
    });
    expect(fourthCallParams).toMatchObject({
      end_time: expect.any(Number),
      outputs: { outputs: "Hello!mitochondria" },
      extra: expect.any(Object),
      dotted_order: firstCallParams.dotted_order,
      trace_id: firstCallParams.id,
      tags: [],
    });
  }
);

test.each(["true", "false"])(
  "runnables nested within traceables and a context var set with background callbacks %s",
  async (value) => {
    const { setContextVariable, getContextVariable } = await import(
      "../../context.js"
    );
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = value;
    setContextVariable("foo", "bar");

    const nested = RunnableLambda.from(async (messages: BaseMessage[]) => {
      const lastMsg = messages.at(-1) as HumanMessage;
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(getContextVariable("foo")).toEqual("bar");
      return [lastMsg.content];
    });

    const aiGreet = traceable(
      async (msg: BaseMessage, name = "world") => {
        const contents = await nested.invoke([msg]);
        expect(getContextVariable("foo")).toEqual("bar");
        return contents[0] + name;
      },
      { name: "aiGreet", tracingEnabled: true, client }
    );

    await aiGreet(new HumanMessage({ content: "Hello!" }), "mitochondria");

    const relevantCalls = fetchMock.mock.calls.filter((call: any) => {
      return call[0].startsWith("https://api.smith.langchain.com/runs");
    });

    expect(relevantCalls.length).toEqual(4);
    const firstCallParams = JSON.parse(
      decoder.decode((relevantCalls[0][1] as any).body)
    );
    const secondCallParams = JSON.parse(
      decoder.decode((relevantCalls[1][1] as any).body)
    );
    const thirdCallParams = JSON.parse(
      decoder.decode((relevantCalls[2][1] as any).body)
    );
    const fourthCallParams = JSON.parse(
      decoder.decode((relevantCalls[3][1] as any).body)
    );
    expect(firstCallParams).toMatchObject({
      id: firstCallParams.id,
      name: "aiGreet",
      start_time: expect.any(String),
      run_type: "chain",
      extra: expect.any(Object),
      serialized: {},
      inputs: {
        args: [
          {
            lc: 1,
            type: "constructor",
            id: ["langchain_core", "messages", "HumanMessage"],
            kwargs: {
              content: "Hello!",
              additional_kwargs: {},
              response_metadata: {},
            },
          },
          "mitochondria",
        ],
      },
      child_runs: [],
      trace_id: firstCallParams.id,
      dotted_order: firstCallParams.dotted_order,
      tags: [],
    });
    expect(secondCallParams).toMatchObject({
      id: secondCallParams.id,
      name: "RunnableLambda",
      parent_run_id: firstCallParams.id,
      start_time: expect.any(String),
      serialized: {
        lc: 1,
        type: "not_implemented",
        id: ["langchain_core", "runnables", "RunnableLambda"],
      },
      events: [{ name: "start", time: expect.any(String) }],
      inputs: {
        input: [
          {
            lc: 1,
            type: "constructor",
            id: ["langchain_core", "messages", "HumanMessage"],
            kwargs: {
              content: "Hello!",
              additional_kwargs: {},
              response_metadata: {},
            },
          },
        ],
      },
      run_type: "chain",
      extra: expect.any(Object),
      tags: [],
      trace_id: firstCallParams.id,
      dotted_order: expect.stringContaining(`${firstCallParams.dotted_order}.`),
    });
    expect(thirdCallParams).toMatchObject({
      end_time: expect.any(Number),
      outputs: { output: ["Hello!"] },
      events: [
        { name: "start", time: expect.any(String) },
        { name: "end", time: expect.any(String) },
      ],
      trace_id: firstCallParams.id,
      dotted_order: expect.stringContaining(`${firstCallParams.dotted_order}.`),
      parent_run_id: firstCallParams.id,
    });
    expect(fourthCallParams).toMatchObject({
      end_time: expect.any(Number),
      outputs: { outputs: "Hello!mitochondria" },
      extra: expect.any(Object),
      dotted_order: firstCallParams.dotted_order,
      trace_id: firstCallParams.id,
      tags: [],
    });
  }
);

test.each(["true", "false"])(
  "streaming runnables nested within traceables with background callbacks %s",
  async (value) => {
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = value;

    const nested = RunnableLambda.from(async function* (
      messages: BaseMessage[]
    ) {
      const lastMsg = messages.at(-1) as HumanMessage;
      await new Promise((resolve) => setTimeout(resolve, 300));
      for (const letter of (lastMsg.content as string).split("")) {
        yield letter;
      }
    });

    const aiGreet = traceable(
      async function* (msg: BaseMessage, name = "world") {
        for await (const chunk of await nested.stream([msg])) {
          yield chunk;
        }
        for (const letter of name.split("")) {
          yield letter;
        }
      },
      { name: "aiGreet", tracingEnabled: true, client }
    );

    for await (const _ of aiGreet(
      new HumanMessage({ content: "Hello!" }),
      "mitochondria"
    )) {
      // Just consume iterator
    }

    const relevantCalls = fetchMock.mock.calls.filter((call: any) => {
      return call[0].startsWith("https://api.smith.langchain.com/runs");
    });

    expect(relevantCalls.length).toEqual(4);
    const firstCallParams = JSON.parse(
      decoder.decode((relevantCalls[0][1] as any).body)
    );
    const secondCallParams = JSON.parse(
      decoder.decode((relevantCalls[1][1] as any).body)
    );
    const thirdCallParams = JSON.parse(
      decoder.decode((relevantCalls[2][1] as any).body)
    );
    const fourthCallParams = JSON.parse(
      decoder.decode((relevantCalls[3][1] as any).body)
    );
    expect(firstCallParams).toMatchObject({
      id: firstCallParams.id,
      name: "aiGreet",
      start_time: expect.any(String),
      run_type: "chain",
      extra: expect.any(Object),
      serialized: {},
      inputs: {
        args: [
          {
            lc: 1,
            type: "constructor",
            id: ["langchain_core", "messages", "HumanMessage"],
            kwargs: {
              content: "Hello!",
              additional_kwargs: {},
              response_metadata: {},
            },
          },
          "mitochondria",
        ],
      },
      child_runs: [],
      trace_id: firstCallParams.id,
      dotted_order: firstCallParams.dotted_order,
      tags: [],
    });
    expect(secondCallParams).toMatchObject({
      id: secondCallParams.id,
      name: "RunnableLambda",
      parent_run_id: firstCallParams.id,
      start_time: expect.any(String),
      serialized: {
        lc: 1,
        type: "not_implemented",
        id: ["langchain_core", "runnables", "RunnableLambda"],
      },
      events: [{ name: "start", time: expect.any(String) }],
      inputs: {
        input: "",
      },
      run_type: "chain",
      extra: expect.any(Object),
      tags: [],
      trace_id: firstCallParams.id,
      dotted_order: expect.stringContaining(`${firstCallParams.dotted_order}.`),
    });
    expect(thirdCallParams).toMatchObject({
      end_time: expect.any(Number),
      outputs: { output: "Hello!" },
      events: [
        { name: "start", time: expect.any(String) },
        { name: "end", time: expect.any(String) },
      ],
      trace_id: firstCallParams.id,
      dotted_order: expect.stringContaining(`${firstCallParams.dotted_order}.`),
      parent_run_id: firstCallParams.id,
    });
    expect(fourthCallParams).toMatchObject({
      end_time: expect.any(Number),
      outputs: {
        outputs: [
          "H",
          "e",
          "l",
          "l",
          "o",
          "!",
          "m",
          "i",
          "t",
          "o",
          "c",
          "h",
          "o",
          "n",
          "d",
          "r",
          "i",
          "a",
        ],
      },
      extra: expect.any(Object),
      dotted_order: firstCallParams.dotted_order,
      trace_id: firstCallParams.id,
      tags: [],
    });
  }
);

test.each(["true", "false"])(
  "runnable nested within a traceable with manual tracer passed, background callbacks: %s",
  async (value) => {
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = value;

    const child = RunnableLambda.from(async () => {
      return { message: new HumanMessage({ content: "From child!" }) };
    }).withConfig({ runName: "child" });

    const parent = traceable(
      async () => {
        return child.invoke(
          {},
          {
            callbacks: [new LangChainTracer()],
          }
        );
      },
      { name: "parent", tracingEnabled: true, client }
    );

    await parent();

    await awaitAllCallbacks();
    await client.awaitPendingTraceBatches();

    const relevantCalls = fetchMock.mock.calls.filter((call: any) => {
      return call[0].startsWith("https://api.smith.langchain.com/runs");
    });

    expect(relevantCalls.length).toEqual(4);
    const firstCallParams = JSON.parse(
      decoder.decode((relevantCalls[0][1] as any).body)
    );
    const secondCallParams = JSON.parse(
      decoder.decode((relevantCalls[1][1] as any).body)
    );
    const thirdCallParams = JSON.parse(
      decoder.decode((relevantCalls[2][1] as any).body)
    );
    const fourthCallParams = JSON.parse(
      decoder.decode((relevantCalls[3][1] as any).body)
    );
    const callParams = [
      firstCallParams,
      secondCallParams,
      thirdCallParams,
      fourthCallParams,
    ];
    const parentCallCreateParams = callParams.find((param) => {
      return param.name === "parent" && param.start_time !== undefined;
    });
    const childCallCreateParams = callParams.find((param) => {
      return param.name === "child" && param.start_time !== undefined;
    });
    const parentCallUpdateParams = callParams.find((param) => {
      return (
        param.dotted_order === parentCallCreateParams.dotted_order &&
        param.end_time !== undefined
      );
    });
    const childCallUpdateParams = callParams.find((param) => {
      return (
        param.dotted_order === childCallCreateParams.dotted_order &&
        param.end_time !== undefined
      );
    });
    expect(parentCallCreateParams).toMatchObject({
      id: parentCallCreateParams.id,
      name: "parent",
      start_time: expect.any(String),
      run_type: "chain",
      extra: expect.any(Object),
      serialized: {},
      inputs: {},
      child_runs: [],
      trace_id: parentCallCreateParams.id,
      dotted_order: parentCallCreateParams.dotted_order,
      tags: [],
    });

    expect(childCallCreateParams).toMatchObject({
      id: expect.any(String),
      name: "child",
      parent_run_id: parentCallCreateParams.id,
      start_time: expect.any(String),
      serialized: {
        lc: 1,
        type: "not_implemented",
        id: ["langchain_core", "runnables", "RunnableLambda"],
      },
      inputs: {},
      run_type: "chain",
      extra: expect.any(Object),
      tags: [],
      trace_id: parentCallCreateParams.id,
      dotted_order: expect.stringContaining(
        `${parentCallCreateParams.dotted_order}.`
      ),
    });

    expect(childCallUpdateParams).toMatchObject({
      end_time: expect.any(Number),
      outputs: {
        message: {
          lc: 1,
          type: "constructor",
          id: ["langchain_core", "messages", "HumanMessage"],
          kwargs: {
            content: "From child!",
            additional_kwargs: {},
            response_metadata: {},
          },
        },
      },
      inputs: {},
      trace_id: parentCallCreateParams.id,
      dotted_order: expect.stringContaining(
        `${parentCallCreateParams.dotted_order}.`
      ),
    });

    expect(parentCallUpdateParams).toMatchObject({
      end_time: expect.any(Number),
      outputs: {
        message: {
          lc: 1,
          type: "constructor",
          id: ["langchain_core", "messages", "HumanMessage"],
          kwargs: {
            content: "From child!",
            additional_kwargs: {},
            response_metadata: {},
          },
        },
      },
      extra: expect.any(Object),
      dotted_order: parentCallCreateParams.dotted_order,
      trace_id: parentCallCreateParams.id,
      tags: [],
    });
  }
);

test.each(["true", "false"])(
  "deep nesting with manual tracer passed with background callbacks: %s",
  async (value) => {
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = value;

    const aiGreet = traceable(
      async (msg: BaseMessage) => {
        const child = RunnableLambda.from(async () => {
          const grandchild = RunnableLambda.from(async () => {
            const greatGrandchild = traceable(
              async () => {
                const greatGreatGrandchild = RunnableLambda.from(async () => {
                  return [
                    new HumanMessage({
                      content: "From great great grandchild!",
                    }),
                  ];
                }).withConfig({ runName: "greatGreatGrandchild" });
                return greatGreatGrandchild.invoke({});
              },
              { name: "greatGrandchild", tracingEnabled: true, client }
            );
            return greatGrandchild({});
          }).withConfig({ runName: "grandchild" });
          return grandchild.invoke({});
        }).withConfig({ runName: "child" });
        return child.invoke([msg]);
      },
      { name: "aiGreet", tracingEnabled: true, client }
    );

    const parent = RunnableLambda.from(async () => {
      return aiGreet(new HumanMessage({ content: "Hello!" }));
    }).withConfig({ runName: "parent" });

    await parent.invoke(
      {},
      {
        callbacks: [new LangChainTracer()],
      }
    );

    await awaitAllCallbacks();

    const relevantCalls = fetchMock.mock.calls.filter((call: any) => {
      return call[0].startsWith("https://api.smith.langchain.com/runs");
    });

    expect(relevantCalls.length).toBeGreaterThan(8);

    const callParams = relevantCalls.map((call: any) =>
      JSON.parse(decoder.decode(call[1].body))
    );

    const parentCall = callParams.find((param: any) => {
      return param.name === "parent" && param.start_time !== undefined;
    });
    const aiGreetCall = callParams.find((param: any) => {
      return param.name === "aiGreet" && param.start_time !== undefined;
    });
    const childCall = callParams.find((param: any) => {
      return param.name === "child" && param.start_time !== undefined;
    });
    const grandchildCall = callParams.find((param: any) => {
      return param.name === "grandchild" && param.start_time !== undefined;
    });
    const greatGrandchildCall = callParams.find((param: any) => {
      return param.name === "greatGrandchild" && param.start_time !== undefined;
    });
    const greatGreatGrandchildCall = callParams.find((param: any) => {
      return (
        param.name === "greatGreatGrandchild" && param.start_time !== undefined
      );
    });

    expect(parentCall).toMatchObject({
      name: "parent",
      trace_id: parentCall.id,
    });

    expect(aiGreetCall).toMatchObject({
      name: "aiGreet",
      parent_run_id: parentCall.id,
      trace_id: parentCall.id,
      dotted_order: expect.stringContaining(`${parentCall.dotted_order}.`),
    });

    expect(childCall).toMatchObject({
      name: "child",
      parent_run_id: aiGreetCall.id,
      trace_id: parentCall.id,
      dotted_order: expect.stringContaining(`${aiGreetCall.dotted_order}.`),
    });

    expect(grandchildCall).toMatchObject({
      name: "grandchild",
      parent_run_id: childCall.id,
      trace_id: parentCall.id,
      dotted_order: expect.stringContaining(`${childCall.dotted_order}.`),
    });

    expect(greatGrandchildCall).toMatchObject({
      name: "greatGrandchild",
      parent_run_id: grandchildCall.id,
      trace_id: parentCall.id,
      dotted_order: expect.stringContaining(`${grandchildCall.dotted_order}.`),
    });

    expect(greatGreatGrandchildCall).toMatchObject({
      name: "greatGreatGrandchild",
      parent_run_id: greatGrandchildCall.id,
      trace_id: parentCall.id,
      dotted_order: expect.stringContaining(
        `${greatGrandchildCall.dotted_order}.`
      ),
    });

    const greatGreatGrandchildEndCall = callParams.find((param: any) => {
      return (
        param.dotted_order === greatGreatGrandchildCall.dotted_order &&
        param.end_time !== undefined
      );
    });

    expect(greatGreatGrandchildEndCall).toMatchObject({
      end_time: expect.any(Number),
      outputs: {
        output: expect.arrayContaining([
          expect.objectContaining({
            lc: 1,
            type: "constructor",
            id: ["langchain_core", "messages", "HumanMessage"],
            kwargs: expect.objectContaining({
              content: "From great great grandchild!",
            }),
          }),
        ]),
      },
    });
  }
);

test.each(["true", "false"])(
  "deep nesting with traceable parent and manual tracer passed with background callbacks: %s",
  async (value) => {
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = value;

    const childCallbacks = [new LangChainTracer()];

    const parent = traceable(
      async (msg: BaseMessage) => {
        const child = RunnableLambda.from(async () => {
          const grandchild = RunnableLambda.from(async () => {
            const greatGrandchild = traceable(
              async () => {
                const greatGreatGrandchild = RunnableLambda.from(async () => {
                  return [
                    new HumanMessage({
                      content: "From great great grandchild!",
                    }),
                  ];
                }).withConfig({ runName: "greatGreatGrandchild" });
                return greatGreatGrandchild.invoke({});
              },
              { name: "greatGrandchild", tracingEnabled: true, client }
            );
            return greatGrandchild({});
          }).withConfig({ runName: "grandchild" });
          return grandchild.invoke({});
        }).withConfig({ runName: "child" });
        return child.invoke([msg], { callbacks: childCallbacks });
      },
      { name: "parent", tracingEnabled: true, client }
    );

    await parent(new HumanMessage({ content: "Hello!" }));

    await awaitAllCallbacks();

    const relevantCalls = fetchMock.mock.calls.filter((call: any) => {
      return call[0].startsWith("https://api.smith.langchain.com/runs");
    });

    expect(relevantCalls.length).toBeGreaterThan(8);

    const callParams = relevantCalls.map((call: any) =>
      JSON.parse(decoder.decode(call[1].body))
    );

    const parentCall = callParams.find((param: any) => {
      return param.name === "parent" && param.start_time !== undefined;
    });
    const childCall = callParams.find((param: any) => {
      return param.name === "child" && param.start_time !== undefined;
    });
    const grandchildCall = callParams.find((param: any) => {
      return param.name === "grandchild" && param.start_time !== undefined;
    });
    const greatGrandchildCall = callParams.find((param: any) => {
      return param.name === "greatGrandchild" && param.start_time !== undefined;
    });
    const greatGreatGrandchildCall = callParams.find((param: any) => {
      return (
        param.name === "greatGreatGrandchild" && param.start_time !== undefined
      );
    });

    expect(parentCall).toMatchObject({
      name: "parent",
      trace_id: parentCall.id,
    });
    expect(childCall).toMatchObject({
      name: "child",
      parent_run_id: parentCall.id,
      trace_id: parentCall.id,
      dotted_order: expect.stringContaining(`${parentCall.dotted_order}.`),
    });

    expect(grandchildCall).toMatchObject({
      name: "grandchild",
      parent_run_id: childCall.id,
      trace_id: parentCall.id,
      dotted_order: expect.stringContaining(`${childCall.dotted_order}.`),
    });

    expect(greatGrandchildCall).toMatchObject({
      name: "greatGrandchild",
      parent_run_id: grandchildCall.id,
      trace_id: parentCall.id,
      dotted_order: expect.stringContaining(`${grandchildCall.dotted_order}.`),
    });

    expect(greatGreatGrandchildCall).toMatchObject({
      name: "greatGreatGrandchild",
      parent_run_id: greatGrandchildCall.id,
      trace_id: parentCall.id,
      dotted_order: expect.stringContaining(
        `${greatGrandchildCall.dotted_order}.`
      ),
    });

    const greatGreatGrandchildEndCall = callParams.find((param: any) => {
      return (
        param.dotted_order === greatGreatGrandchildCall.dotted_order &&
        param.end_time !== undefined
      );
    });

    expect(greatGreatGrandchildEndCall).toMatchObject({
      end_time: expect.any(Number),
      outputs: {
        output: expect.arrayContaining([
          expect.objectContaining({
            lc: 1,
            type: "constructor",
            id: ["langchain_core", "messages", "HumanMessage"],
            kwargs: expect.objectContaining({
              content: "From great great grandchild!",
            }),
          }),
        ]),
      },
    });
  }
);

test("LangChain V2 tracer creates and updates runs with replicas", async () => {
  const projectNames = ["replica1", "replica2"];
  const referenceExampleId = "00000000-0000-0000-0000-000000000000";
  const tracer = new LangChainTracer({
    replicas: [
      [projectNames[0], { reference_example_id: referenceExampleId }],
      [projectNames[1], undefined],
    ],
  });
  const child = traceable(
    async (input: string) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return `child: ${input.split("").reverse().join("")}`;
    },
    { name: "child", tracingEnabled: true, client }
  );
  const parent = RunnableLambda.from(async (input: string) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const childResult = await child(input);
    return `parent: ${input}; ${childResult}`;
  });

  const result = await parent.invoke("test input", { callbacks: [tracer] });

  expect(result).toEqual("parent: test input; child: tupni tset");

  await awaitAllCallbacks();

  const relevantCalls = fetchMock.mock.calls.filter((call: any) => {
    return call[0].startsWith("https://api.smith.langchain.com/runs");
  });

  expect(relevantCalls.length).toEqual(8);
  const firstCallParams = JSON.parse(
    decoder.decode((relevantCalls[0][1] as any).body)
  );
  const secondCallParams = JSON.parse(
    decoder.decode((relevantCalls[1][1] as any).body)
  );
  const thirdCallParams = JSON.parse(
    decoder.decode((relevantCalls[2][1] as any).body)
  );
  const fourthCallParams = JSON.parse(
    decoder.decode((relevantCalls[3][1] as any).body)
  );
  const fifthCallParams = JSON.parse(
    decoder.decode((relevantCalls[4][1] as any).body)
  );
  const sixthCallParams = JSON.parse(
    decoder.decode((relevantCalls[5][1] as any).body)
  );
  const seventhCallParams = JSON.parse(
    decoder.decode((relevantCalls[6][1] as any).body)
  );
  const eighthCallParams = JSON.parse(
    decoder.decode((relevantCalls[7][1] as any).body)
  );
  expect(relevantCalls[0][1].method).toEqual("POST");
  expect(firstCallParams).toMatchObject({
    session_name: "replica1",
    name: "RunnableLambda",
  });
  expect(firstCallParams.reference_example_id).toEqual(undefined);
  expect(relevantCalls[1][1].method).toEqual("POST");
  expect(secondCallParams).toMatchObject({
    session_name: "replica2",
    name: "RunnableLambda",
  });
  expect(secondCallParams.reference_example_id).toEqual(undefined);
  expect(relevantCalls[2][1].method).toEqual("POST");
  expect(thirdCallParams).toMatchObject({
    session_name: "replica1",
    name: "child",
  });
  expect(thirdCallParams.reference_example_id).toEqual(undefined);
  expect(relevantCalls[3][1].method).toEqual("POST");
  expect(fourthCallParams).toMatchObject({
    session_name: "replica2",
    name: "child",
  });
  expect(fourthCallParams.reference_example_id).toEqual(undefined);
  expect(relevantCalls[4][1].method).toEqual("PATCH");
  expect(fifthCallParams).toMatchObject({
    session_name: "replica1",
    parent_run_id: firstCallParams.id,
    reference_example_id: referenceExampleId,
  });
  expect(relevantCalls[5][1].method).toEqual("PATCH");
  expect(sixthCallParams).toMatchObject({
    session_name: "replica2",
    parent_run_id: secondCallParams.id,
  });
  expect(sixthCallParams.reference_example_id).toEqual(undefined);
  expect(relevantCalls[6][1].method).toEqual("PATCH");
  expect(seventhCallParams).toMatchObject({
    session_name: "replica1",
    reference_example_id: referenceExampleId,
  });
  expect(relevantCalls[7][1].method).toEqual("PATCH");
  expect(eighthCallParams).toMatchObject({
    session_name: "replica2",
  });
  expect(eighthCallParams.reference_example_id).toEqual(undefined);
});
