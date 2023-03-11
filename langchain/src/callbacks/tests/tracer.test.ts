import { test, expect, jest } from "@jest/globals";
import {
  BaseTracer,
  LLMRun,
  ChainRun,
  ToolRun,
  TracerSession,
  TracerSessionCreate,
} from "../tracers/index.js";

const TEST_SESSION_ID = 2023;
const _DATE = 1620000000000;

Date.now = jest.fn(() => _DATE);

class FakeTracer extends BaseTracer {
  runs: (LLMRun | ChainRun | ToolRun)[] = [];

  constructor() {
    super();
  }

  protected persistRun(run: LLMRun | ChainRun | ToolRun): Promise<void> {
    this.runs.push(run);
    return Promise.resolve();
  }

  protected persistSession(
    session: TracerSessionCreate
  ): Promise<TracerSession> {
    return Promise.resolve({
      id: TEST_SESSION_ID,
      ...session,
    });
  }

  async loadSession(sessionName: string): Promise<TracerSession> {
    return Promise.resolve({
      id: TEST_SESSION_ID,
      name: sessionName,
      startTime: _DATE,
    });
  }

  async loadDefaultSession(): Promise<TracerSession> {
    return Promise.resolve({
      id: TEST_SESSION_ID,
      name: "default",
      startTime: _DATE,
    });
  }
}

test("Test LLMRun", async () => {
  const compareRun: LLMRun = {
    startTime: _DATE,
    endTime: _DATE,
    executionOrder: 1,
    serialized: { name: "test" },
    sessionId: TEST_SESSION_ID,
    prompts: ["test"],
    type: "llm",
    response: { generations: [] },
  };
  const tracer = new FakeTracer();
  await tracer.newSession();
  await tracer.handleLLMStart({ name: "test" }, ["test"]);
  await tracer.handleLLMEnd({ generations: [] });
  expect(tracer.runs.length).toBe(1);
  const run = tracer.runs[0];
  expect(run).toEqual(compareRun);
});

test("Test LLM Run no session", async () => {
  const tracer = new FakeTracer();
  await expect(
    tracer.handleLLMStart({ name: "test" }, ["test"])
  ).rejects.toThrow("Initialize a session before starting a trace.");
});

test("Test LLM Run no start", async () => {
  const tracer = new FakeTracer();
  await tracer.newSession();
  await expect(tracer.handleLLMEnd({ generations: [] })).rejects.toThrow(
    "No LLM run to end"
  );
});

test("Test Chain Run", async () => {
  const compareRun: ChainRun = {
    startTime: _DATE,
    endTime: _DATE,
    executionOrder: 1,
    serialized: { name: "test" },
    sessionId: TEST_SESSION_ID,
    inputs: { foo: "bar" },
    outputs: { foo: "bar" },
    type: "chain",
    childLLMRuns: [],
    childChainRuns: [],
    childToolRuns: [],
  };
  const tracer = new FakeTracer();
  await tracer.newSession();
  await tracer.handleChainStart({ name: "test" }, { foo: "bar" });
  await tracer.handleChainEnd({ foo: "bar" });
  expect(tracer.runs.length).toBe(1);
  const run = tracer.runs[0];
  expect(run).toEqual(compareRun);
});

test("Test Tool Run", async () => {
  const compareRun: ToolRun = {
    startTime: _DATE,
    endTime: _DATE,
    executionOrder: 1,
    serialized: { name: "test" },
    sessionId: TEST_SESSION_ID,
    toolInput: "test",
    output: "output",
    type: "tool",
    action: JSON.stringify({ name: "test" }),
    childLLMRuns: [],
    childChainRuns: [],
    childToolRuns: [],
  };
  const tracer = new FakeTracer();
  await tracer.newSession();
  await tracer.handleToolStart({ name: "test" }, "test");
  await tracer.handleToolEnd("output");
  expect(tracer.runs.length).toBe(1);
  const run = tracer.runs[0];
  expect(run).toEqual(compareRun);
});

test("Test nested runs", async () => {
  const compareRun: ChainRun = {
    childChainRuns: [],
    childLLMRuns: [
      {
        endTime: 1620000000000,
        executionOrder: 4,
        prompts: ["test"],
        response: {
          generations: [],
        },
        serialized: {
          name: "test2",
        },
        sessionId: 2023,
        startTime: 1620000000000,
        type: "llm",
      },
    ],
    childToolRuns: [
      {
        action: '{"name":"test"}',
        childChainRuns: [],
        childLLMRuns: [
          {
            endTime: 1620000000000,
            executionOrder: 3,
            prompts: ["test"],
            response: {
              generations: [],
            },
            serialized: {
              name: "test",
            },
            sessionId: 2023,
            startTime: 1620000000000,
            type: "llm",
          },
        ],
        childToolRuns: [],
        endTime: 1620000000000,
        executionOrder: 2,
        output: "output",
        serialized: {
          name: "test",
        },
        sessionId: 2023,
        startTime: 1620000000000,
        toolInput: "test",
        type: "tool",
      },
    ],
    endTime: 1620000000000,
    executionOrder: 1,
    inputs: {
      foo: "bar",
    },
    outputs: {
      foo: "bar",
    },
    serialized: {
      name: "test",
    },
    sessionId: 2023,
    startTime: 1620000000000,
    type: "chain",
  };

  const tracer = new FakeTracer();
  await tracer.newSession();
  await tracer.handleChainStart({ name: "test" }, { foo: "bar" });
  await tracer.handleToolStart({ name: "test" }, "test");
  await tracer.handleLLMStart({ name: "test" }, ["test"]);
  await tracer.handleLLMEnd({ generations: [] });
  await tracer.handleToolEnd("output");
  await tracer.handleLLMStart({ name: "test2" }, ["test"]);
  await tracer.handleLLMEnd({ generations: [] });
  await tracer.handleChainEnd({ foo: "bar" });
  expect(tracer.runs.length).toBe(1);
  expect(tracer.runs[0]).toEqual(compareRun);

  await tracer.handleLLMStart({ name: "test" }, ["test"]);
  await tracer.handleLLMEnd({ generations: [] });
  expect(tracer.runs.length).toBe(2);
});
