/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-process-env */

import { jest } from "@jest/globals";
import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";

import { RunnableLambda } from "../../runnables/base.js";
import { BaseMessage, HumanMessage } from "../../messages/index.js";
import { LangChainTracer } from "../tracer_langchain.js";

type ClientParams = Exclude<ConstructorParameters<typeof Client>[0], undefined>;

const mockClient = (config?: Omit<ClientParams, "autoBatchTracing">) => {
  const client = new Client({
    ...config,
    apiKey: "MOCK",
    autoBatchTracing: false,
  });
  const callSpy = jest
    .spyOn((client as any).caller, "call")
    .mockResolvedValue({ ok: true, text: () => "" });

  const langChainTracer = new LangChainTracer({
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Overriden client
    client,
  });

  return { client, callSpy, langChainTracer };
};

test.each(["true", "false"])(
  "traceables nested within runnables with background callbacks %s",
  async (value) => {
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = value;
    const { callSpy, langChainTracer: tracer } = mockClient();

    const aiGreet = traceable(
      async (msg: BaseMessage, name = "world") => {
        return msg.content + name;
      },
      { name: "aiGreet" }
    );

    const root = RunnableLambda.from(async (messages: BaseMessage[]) => {
      const lastMsg = messages.at(-1) as HumanMessage;
      const greetOne = await aiGreet(lastMsg, "David");

      return [greetOne];
    });

    await root.invoke([new HumanMessage({ content: "Hello!" })], {
      callbacks: [tracer],
    });

    expect(callSpy.mock.calls.length).toEqual(4);
    const firstCallParams = JSON.parse((callSpy.mock.calls[0][2] as any).body);
    const secondCallParams = JSON.parse((callSpy.mock.calls[1][2] as any).body);
    const thirdCallParams = JSON.parse((callSpy.mock.calls[2][2] as any).body);
    const fourthCallParams = JSON.parse((callSpy.mock.calls[3][2] as any).body);
    expect(firstCallParams).toEqual({
      session_name: expect.any(String),
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
    expect(secondCallParams).toEqual({
      session_name: expect.any(String),
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
    expect(thirdCallParams).toEqual({
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
    expect(fourthCallParams).toEqual({
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
    const { callSpy, langChainTracer: tracer } = mockClient();

    const aiGreet = traceable(
      async function* (msg: BaseMessage, name = "world") {
        const res = msg.content + name;
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

    const stream = await root.stream(
      [new HumanMessage({ content: "Hello!" })],
      {
        callbacks: [tracer],
      }
    );

    for await (const chunk of stream) {
      console.log(chunk);
    }

    expect(callSpy.mock.calls.length).toEqual(4);
    const firstCallParams = JSON.parse((callSpy.mock.calls[0][2] as any).body);
    const secondCallParams = JSON.parse((callSpy.mock.calls[1][2] as any).body);
    const thirdCallParams = JSON.parse((callSpy.mock.calls[2][2] as any).body);
    const fourthCallParams = JSON.parse((callSpy.mock.calls[3][2] as any).body);
    expect(firstCallParams).toEqual({
      session_name: expect.any(String),
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
    expect(secondCallParams).toEqual({
      session_name: expect.any(String),
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
    expect(thirdCallParams).toEqual({
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
    expect(fourthCallParams).toEqual({
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
    const { client, callSpy } = mockClient();

    const nested = RunnableLambda.from(async (messages: BaseMessage[]) => {
      const lastMsg = messages.at(-1) as HumanMessage;
      return [lastMsg.content];
    });

    const aiGreet = traceable(
      async (msg: BaseMessage, name = "world") => {
        const contents = await nested.invoke([msg]);
        return contents[0] + name;
      },
      { name: "aiGreet", client, tracingEnabled: true }
    );

    await aiGreet(new HumanMessage({ content: "Hello!" }), "mitochondria");

    expect(callSpy.mock.calls.length).toEqual(4);
    const firstCallParams = JSON.parse((callSpy.mock.calls[0][2] as any).body);
    const secondCallParams = JSON.parse((callSpy.mock.calls[1][2] as any).body);
    const thirdCallParams = JSON.parse((callSpy.mock.calls[2][2] as any).body);
    const fourthCallParams = JSON.parse((callSpy.mock.calls[3][2] as any).body);
    expect(firstCallParams).toEqual({
      session_name: expect.any(String),
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
    expect(secondCallParams).toEqual({
      session_name: expect.any(String),
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
    expect(thirdCallParams).toEqual({
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
    expect(fourthCallParams).toEqual({
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
    const { client, callSpy } = mockClient();

    const nested = RunnableLambda.from(async function* (
      messages: BaseMessage[]
    ) {
      const lastMsg = messages.at(-1) as HumanMessage;
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
      { name: "aiGreet", client, tracingEnabled: true }
    );

    for await (const chunk of aiGreet(
      new HumanMessage({ content: "Hello!" }),
      "mitochondria"
    )) {
      console.log(chunk);
    }

    expect(callSpy.mock.calls.length).toEqual(4);
    const firstCallParams = JSON.parse((callSpy.mock.calls[0][2] as any).body);
    const secondCallParams = JSON.parse((callSpy.mock.calls[1][2] as any).body);
    const thirdCallParams = JSON.parse((callSpy.mock.calls[2][2] as any).body);
    const fourthCallParams = JSON.parse((callSpy.mock.calls[3][2] as any).body);
    expect(firstCallParams).toEqual({
      session_name: expect.any(String),
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
    expect(secondCallParams).toEqual({
      session_name: expect.any(String),
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
    expect(thirdCallParams).toEqual({
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
    expect(fourthCallParams).toEqual({
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
