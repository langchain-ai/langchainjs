import { test, jest, expect } from "@jest/globals";
import * as uuid from "uuid";
import { Run } from "@langchain/core/tracers/base";

import { HumanMessage, AIMessage } from "@langchain/core/messages";
import {
  DatadogLLMObsRequestBody,
  DatadogLLMObsSpan,
  DatadogLLMObsTracer,
} from "../datadog.js";

const _DATE = 1620000000000;
const _END_DATE = _DATE + 1000;

Date.now = jest.fn(() => _DATE);

const BASE_URL = "http://datadog-endpoint";

class FakeDatadogLLMObsTracer extends DatadogLLMObsTracer {
  public persistRun(_run: Run) {
    return super.persistRun(_run);
  }

  public uuidToBigInt(uuid: string) {
    return super.uuidToBigInt(uuid);
  }

  public milisecondsToNanoseconds(ms: number) {
    return super.milisecondsToNanoseconds(ms);
  }
}

beforeEach(() => {
  const oldFetch = global.fetch;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.fetch = jest.fn().mockImplementation(async (url: any, init?: any) => {
    if (!url.startsWith(BASE_URL)) return await oldFetch(url, init);
    const resp: Response = new Response();
    return resp;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
});

afterEach(() => {
  jest.restoreAllMocks();
});

const runId = uuid.v4();
const traceId = uuid.v4();

const baseRun = {
  id: runId,
  trace_id: traceId,
  parent_run_id: undefined,
  name: "test",
  start_time: _DATE,
  end_time: _END_DATE,
  execution_order: 1,
  child_execution_order: 0,

  child_runs: [],
  extra: {},
  tags: [],
  events: [],
};

const createBaseSpan = (tracer: FakeDatadogLLMObsTracer) => ({
  span_id: tracer.uuidToBigInt(runId),
  trace_id: tracer.uuidToBigInt(traceId),
  parent_id: "undefined",
  name: "test",
  start_ns: tracer.milisecondsToNanoseconds(_DATE),
  duration: tracer.milisecondsToNanoseconds(_END_DATE - _DATE),
  error: 0,
  status: "ok",
  metrics: {},
});

const tracerConfig = {
  mlApp: "test",
  userHandle: "test",
  userId: "test",
  sessionId: "test",
  service: "test",
  env: "test",
  tags: {},
  ddLLMObsEndpoint: BASE_URL,
};

test("Test llm span with message input", async () => {
  const tracer = new FakeDatadogLLMObsTracer(tracerConfig);

  const run: Run = {
    ...baseRun,
    run_type: "llm",
    inputs: {
      messages: [[new HumanMessage("test")]],
    },
    outputs: {
      generations: [
        [
          {
            message: new AIMessage("test"),
          },
        ],
      ],
    },
  };

  const compareSpan: DatadogLLMObsSpan = {
    ...createBaseSpan(tracer),
    meta: {
      kind: "llm",
      input: {
        messages: [{ content: "test", role: "human" }],
      },
      output: {
        messages: [{ content: "test", role: "ai" }],
      },
    },
  };

  const requestBody: DatadogLLMObsRequestBody = {
    data: {
      type: "span",
      attributes: {
        ml_app: "test",
        tags: ["env:test", "service:test", "user_handle:test", "user_id:test"],
        spans: [compareSpan],
        session_id: "test",
      },
    },
  };

  await tracer.persistRun(run);

  expect(fetch).toBeCalledWith(expect.any(String), {
    body: expect.any(String),
    headers: expect.any(Object),
    method: "POST",
  });

  const { body } = (fetch as jest.Mock).mock.calls[0][1] as { body: string };
  const parsedBody = JSON.parse(body) as DatadogLLMObsRequestBody;
  expect(parsedBody).toMatchObject(
    requestBody as unknown as Record<string, unknown>
  );
});

test("Test llm span with prompt input", async () => {
  const tracer = new FakeDatadogLLMObsTracer(tracerConfig);

  const run: Run = {
    ...baseRun,
    run_type: "llm",
    inputs: {
      prompts: ["Hello", "World"],
    },
    outputs: {
      generations: [
        [
          {
            message: new AIMessage("Hi"),
          },
        ],
      ],
    },
  };

  const compareSpan: DatadogLLMObsSpan = {
    ...createBaseSpan(tracer),
    meta: {
      kind: "llm",
      input: {
        value: "Hello\nWorld",
      },
      output: {
        messages: [{ content: "Hi" }],
      },
    },
  };

  const requestBody: DatadogLLMObsRequestBody = {
    data: {
      type: "span",
      attributes: {
        ml_app: "test",
        tags: ["env:test", "service:test", "user_handle:test", "user_id:test"],
        spans: [compareSpan],
        session_id: "test",
      },
    },
  };

  await tracer.persistRun(run);

  expect(fetch).toBeCalledWith(expect.any(String), {
    body: expect.any(String),
    headers: expect.any(Object),
    method: "POST",
  });

  const { body } = (fetch as jest.Mock).mock.calls[0][1] as { body: string };
  const parsedBody = JSON.parse(body) as DatadogLLMObsRequestBody;
  expect(parsedBody).toMatchObject(
    requestBody as unknown as Record<string, unknown>
  );
});

test("Test workflow span", async () => {
  const tracer = new FakeDatadogLLMObsTracer(tracerConfig);

  const run: Run = {
    ...baseRun,
    run_type: "chain",
    inputs: {
      question: "test",
    },
    outputs: {
      output: "test",
    },
    tags: ["seq:test"],
  };

  const compareSpan: DatadogLLMObsSpan = {
    ...createBaseSpan(tracer),
    meta: {
      kind: "workflow",
      input: {
        value: JSON.stringify(run.inputs),
      },
      output: {
        value: JSON.stringify(run.outputs?.output),
      },
    },
    tags: run.tags,
  };

  const requestBody: DatadogLLMObsRequestBody = {
    data: {
      type: "span",
      attributes: {
        ml_app: "test",
        tags: ["env:test", "service:test", "user_handle:test", "user_id:test"],
        spans: [compareSpan],
        session_id: "test",
      },
    },
  };

  await tracer.persistRun(run);

  expect(fetch).toBeCalledWith(expect.any(String), {
    body: expect.any(String),
    headers: expect.any(Object),
    method: "POST",
  });

  const { body } = (fetch as jest.Mock).mock.calls[0][1] as { body: string };

  const parsedBody = JSON.parse(body) as DatadogLLMObsRequestBody;
  expect(parsedBody).toMatchObject(
    requestBody as unknown as Record<string, unknown>
  );
});

test("Test tool span", async () => {
  const tracer = new FakeDatadogLLMObsTracer(tracerConfig);

  const run: Run = {
    ...baseRun,
    run_type: "tool",
    inputs: {
      input: { query: "test" },
    },
    outputs: {
      output: "test",
    },
  };

  const compareSpan: DatadogLLMObsSpan = {
    ...createBaseSpan(tracer),
    meta: {
      kind: "tool",
      input: {
        value: JSON.stringify(run.inputs),
      },
      output: {
        value: JSON.stringify(run.outputs?.output),
      },
    },
  };

  const requestBody: DatadogLLMObsRequestBody = {
    data: {
      type: "span",
      attributes: {
        ml_app: "test",
        tags: ["env:test", "service:test", "user_handle:test", "user_id:test"],
        spans: [compareSpan],
        session_id: "test",
      },
    },
  };

  await tracer.persistRun(run);

  expect(fetch).toBeCalledWith(expect.any(String), {
    body: expect.any(String),
    headers: expect.any(Object),
    method: "POST",
  });

  const { body } = (fetch as jest.Mock).mock.calls[0][1] as { body: string };
  const parsedBody = JSON.parse(body) as DatadogLLMObsRequestBody;
  expect(parsedBody).toMatchObject(
    requestBody as unknown as Record<string, unknown>
  );
});

test("Test retrieval span", async () => {
  const tracer = new FakeDatadogLLMObsTracer(tracerConfig);

  const run: Run = {
    ...baseRun,
    run_type: "retriever",
    inputs: {
      input: { query: "test" },
    },
    outputs: {
      documents: [
        {
          pageContent: "test",
          metadata: { id: "1", name: "test", score: 0.1 },
        },
      ],
    },
  };

  const compareSpan: DatadogLLMObsSpan = {
    ...createBaseSpan(tracer),
    meta: {
      kind: "retrieval",
      input: {
        value: JSON.stringify(run.inputs),
      },
      output: {
        documents: [
          {
            text: "test",
            id: "1",
            name: "test",
            score: 0.1,
          },
        ],
      },
    },
  };

  const requestBody: DatadogLLMObsRequestBody = {
    data: {
      type: "span",
      attributes: {
        ml_app: "test",
        tags: ["env:test", "service:test", "user_handle:test", "user_id:test"],
        spans: [compareSpan],
        session_id: "test",
      },
    },
  };

  await tracer.persistRun(run);

  expect(fetch).toBeCalledWith(expect.any(String), {
    body: expect.any(String),
    headers: expect.any(Object),
    method: "POST",
  });

  const { body } = (fetch as jest.Mock).mock.calls[0][1] as { body: string };
  const parsedBody = JSON.parse(body) as DatadogLLMObsRequestBody;
  expect(parsedBody).toMatchObject(
    requestBody as unknown as Record<string, unknown>
  );
});
