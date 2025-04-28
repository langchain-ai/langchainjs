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
      start_time: expect.any(Number),
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
      execution_order: 1,
      child_execution_order: 1,
      run_type: "chain",
      extra: expect.any(Object),
      tags: [],
      trace_id: firstCallParams.id,
      dotted_order: expect.any(String),
    });
    expect(secondCallParams).toMatchObject({
      id: expect.any(String),
      name: "aiGreet",
      start_time: expect.any(Number),
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
      start_time: expect.any(Number),
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
      execution_order: 1,
      child_execution_order: 1,
      run_type: "chain",
      extra: expect.any(Object),
      tags: [],
      trace_id: firstCallParams.id,
      dotted_order: expect.any(String),
    });
    expect(secondCallParams).toMatchObject({
      id: expect.any(String),
      name: "aiGreet",
      start_time: expect.any(Number),
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
      start_time: expect.any(Number),
      serialized: {
        lc: 1,
        type: "not_implemented",
        id: ["langchain_core", "runnables", "RunnableLambda"],
      },
      events: [{ name: "start", time: expect.any(String) }],
      inputs: {
        input: "",
      },
      execution_order: 1,
      child_execution_order: 1,
      run_type: "chain",
      extra: expect.any(Object),
      tags: [],
      trace_id: firstCallParams.id,
      dotted_order: expect.any(String),
    });
    expect(secondCallParams).toMatchObject({
      id: expect.any(String),
      name: "aiGreet",
      start_time: expect.any(Number),
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
      start_time: expect.any(Number),
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
      start_time: expect.any(Number),
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
      execution_order: 2,
      child_execution_order: 2,
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
      trace_id: firstCallParams.id,
      dotted_order: expect.stringContaining(`${firstCallParams.dotted_order}.`),
      parent_run_id: firstCallParams.id,
    });
    expect(fourthCallParams).toMatchObject({
      end_time: expect.any(Number),
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
      start_time: expect.any(Number),
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
      start_time: expect.any(Number),
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
      execution_order: 2,
      child_execution_order: 2,
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
      trace_id: firstCallParams.id,
      dotted_order: expect.stringContaining(`${firstCallParams.dotted_order}.`),
      parent_run_id: firstCallParams.id,
    });
    expect(fourthCallParams).toMatchObject({
      end_time: expect.any(Number),
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
      start_time: expect.any(Number),
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
      start_time: expect.any(Number),
      serialized: {
        lc: 1,
        type: "not_implemented",
        id: ["langchain_core", "runnables", "RunnableLambda"],
      },
      events: [{ name: "start", time: expect.any(String) }],
      inputs: {
        input: "",
      },
      execution_order: 2,
      child_execution_order: 2,
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
      trace_id: firstCallParams.id,
      dotted_order: expect.stringContaining(`${firstCallParams.dotted_order}.`),
      parent_run_id: firstCallParams.id,
    });
    expect(fourthCallParams).toMatchObject({
      end_time: expect.any(Number),
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
