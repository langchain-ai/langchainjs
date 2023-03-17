import { test, expect, jest } from "@jest/globals";
import {
  BaseTracer,
  LLMRun,
  ChainRun,
  ToolRun,
  TracerSession,
  TracerSessionCreate,
} from "../tracers.js";

const TEST_SESSION_ID = 2023;
const _DATE = 1620000000000;

// eslint-disable-next-line tree-shaking/no-side-effects-in-initialization
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
      start_time: _DATE,
    });
  }

  async loadDefaultSession(): Promise<TracerSession> {
    return Promise.resolve({
      id: TEST_SESSION_ID,
      name: "default",
      start_time: _DATE,
    });
  }
}

test("Test LLMRun", async () => {
  const compareRun: LLMRun = {
    start_time: _DATE,
    end_time: _DATE,
    execution_order: 1,
    serialized: { name: "test" },
    session_id: TEST_SESSION_ID,
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

test("Test LLM Run no start", async () => {
  const tracer = new FakeTracer();
  await tracer.newSession();
  await expect(tracer.handleLLMEnd({ generations: [] })).rejects.toThrow(
    "No LLM run to end"
  );
});

test("Test Chain Run", async () => {
  const compareRun: ChainRun = {
    start_time: _DATE,
    end_time: _DATE,
    execution_order: 1,
    serialized: { name: "test" },
    session_id: TEST_SESSION_ID,
    inputs: { foo: "bar" },
    outputs: { foo: "bar" },
    type: "chain",
    child_llm_runs: [],
    child_chain_runs: [],
    child_tool_runs: [],
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
    start_time: _DATE,
    end_time: _DATE,
    execution_order: 1,
    serialized: { name: "test" },
    session_id: TEST_SESSION_ID,
    tool_input: "test",
    output: "output",
    type: "tool",
    action: JSON.stringify({ name: "test" }),
    child_llm_runs: [],
    child_chain_runs: [],
    child_tool_runs: [],
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
    child_chain_runs: [],
    child_llm_runs: [
      {
        end_time: 1620000000000,
        execution_order: 4,
        prompts: ["test"],
        response: {
          generations: [[]],
        },
        serialized: {
          name: "test2",
        },
        session_id: 2023,
        start_time: 1620000000000,
        type: "llm",
      },
    ],
    child_tool_runs: [
      {
        action: '{"name":"test"}',
        child_chain_runs: [],
        child_llm_runs: [
          {
            end_time: 1620000000000,
            execution_order: 3,
            prompts: ["test"],
            response: {
              generations: [[]],
            },
            serialized: {
              name: "test",
            },
            session_id: 2023,
            start_time: 1620000000000,
            type: "llm",
          },
        ],
        child_tool_runs: [],
        end_time: 1620000000000,
        execution_order: 2,
        output: "output",
        serialized: {
          name: "test",
        },
        session_id: 2023,
        start_time: 1620000000000,
        tool_input: "test",
        type: "tool",
      },
    ],
    end_time: 1620000000000,
    execution_order: 1,
    inputs: {
      foo: "bar",
    },
    outputs: {
      foo: "bar",
    },
    serialized: {
      name: "test",
    },
    session_id: 2023,
    start_time: 1620000000000,
    type: "chain",
  };

  const tracer = new FakeTracer();
  await tracer.newSession();
  await tracer.handleChainStart({ name: "test" }, { foo: "bar" });
  await tracer.handleToolStart({ name: "test" }, "test");
  await tracer.handleLLMStart({ name: "test" }, ["test"]);
  await tracer.handleLLMEnd({ generations: [[]] });
  await tracer.handleToolEnd("output");
  await tracer.handleLLMStart({ name: "test2" }, ["test"]);
  await tracer.handleLLMEnd({ generations: [[]] });
  await tracer.handleChainEnd({ foo: "bar" });
  expect(tracer.runs.length).toBe(1);
  expect(tracer.runs[0]).toEqual(compareRun);

  await tracer.handleLLMStart({ name: "test" }, ["test"]);
  await tracer.handleLLMEnd({ generations: [[]] });
  expect(tracer.runs.length).toBe(2);
});
