import { test, expect, jest } from "@jest/globals";
import { v4 as uuidv4 } from "uuid";
import {
  BaseTracer,
  LLMRun,
  ChainRun,
  ToolRun,
  TracerSession,
  TracerSessionCreate,
    TRACER_RUN_ID,
} from "../tracers.js";
import {RunId} from "../base.js";

const TEST_SESSION_ID = 2023;
const _DATE = 1620000000000;

// eslint-disable-next-line tree-shaking/no-side-effects-in-initialization
Date.now = jest.fn(() => _DATE);

class FakeTracer extends BaseTracer {
  runs: Map<RunId, LLMRun | ChainRun | ToolRun> = new Map();

  constructor() {
    super();
  }

  protected persistRun(run: LLMRun | ChainRun | ToolRun): Promise<void> {
    this.runs.set(run.id, run);
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
  const tracer = new FakeTracer();
  await tracer.newSession();
  const values = await tracer.handleLLMStart({ name: "test" }, ["test"]);
  const runId = values[TRACER_RUN_ID];

  const compareRun: LLMRun = {
    id: runId,
    child_execution_order: 1,
    caller_id: undefined,
    start_time: _DATE,
    end_time: _DATE,
    execution_order: 1,
    serialized: { name: "test" },
    session_id: TEST_SESSION_ID,
    prompts: ["test"],
    type: "llm",
    response: { generations: [] },
  };

  await tracer.handleLLMEnd({ generations: [] }, runId);
  expect(tracer.runs.size).toBe(1);
  const run = tracer.runs.get(runId);
  expect(run).toEqual(compareRun);
});

test("Test LLM Run no start", async () => {
  const tracer = new FakeTracer();
  await tracer.newSession();
  await expect(tracer.handleLLMEnd({ generations: [] }, uuidv4())).rejects.toThrow(
    "No LLM run to end"
  );
});

test("Test Chain Run", async () => {
  const tracer = new FakeTracer();
  await tracer.newSession();
  const values = await tracer.handleChainStart({ name: "test" }, { foo: "bar" });
  const runId = values[TRACER_RUN_ID];
  const compareRun: ChainRun = {
    child_execution_order: 1,
    id: runId,
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
  await tracer.handleChainEnd({ foo: "bar" }, runId);
  expect(tracer.runs.size).toBe(1);
  const run = tracer.runs.get(runId);
  expect(run).toEqual(compareRun);
});

test("Test Tool Run", async () => {
  const tracer = new FakeTracer();
  await tracer.newSession();
  const values = await tracer.handleToolStart({ name: "test" }, "test");
  const runId = values[TRACER_RUN_ID];
  const compareRun: ToolRun = {
    child_execution_order: 1,
    id: runId,
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

  await tracer.handleToolEnd("output", runId);
  expect(tracer.runs.size).toBe(1);
  const run = tracer.runs.get(runId);
  expect(run).toEqual(compareRun);
});

async function _testNestedRun(tracer: FakeTracer): Promise<void> {
  let values;
  values = await tracer.handleChainStart({ name: "test" }, { foo: "bar" });
  const runIdA = values[TRACER_RUN_ID];

  values = await tracer.handleToolStart({ name: "test" }, "test", runIdA);
  const runIdB = values[TRACER_RUN_ID];

  values = await tracer.handleLLMStart({ name: "test" }, ["test"], runIdB);
  const runIdC = values[TRACER_RUN_ID];

  await tracer.handleLLMEnd({ generations: [[]] }, runIdC);
  await tracer.handleToolEnd("output", runIdB);

  values = await tracer.handleLLMStart({ name: "test2" }, ["test"], runIdA);
  const runIdD = values[TRACER_RUN_ID];

  await tracer.handleLLMEnd({ generations: [[]] }, runIdD);
  await tracer.handleChainEnd({ foo: "bar" }, runIdA);

  const compareRun: ChainRun = {
    child_chain_runs: [],
    child_llm_runs: [
      {
        id: runIdD,
        caller_id: runIdA,
        end_time: 1620000000000,
        execution_order: 4,
        child_execution_order: 4,
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
            id: runIdC,
            caller_id: runIdB,
            end_time: 1620000000000,
            execution_order: 3,
            child_execution_order: 3,
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
        id: runIdB,
        caller_id: runIdA,
        child_tool_runs: [],
        end_time: 1620000000000,
        execution_order: 2,
        child_execution_order: 3,
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
    id: runIdA,
    end_time: 1620000000000,
    execution_order: 1,
    child_execution_order: 4,
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
  expect(tracer.runs.get(runIdA)).toEqual(compareRun);
}

test("Test nested runs", async () => {
  const tracer = new FakeTracer();
  await tracer.newSession();
  await _testNestedRun(tracer);
  expect(tracer.runs.size).toBe(1);

  const values = await tracer.handleLLMStart({ name: "test" }, ["test"]);
  await tracer.handleLLMEnd({ generations: [[]] }, values[TRACER_RUN_ID]);
  expect(tracer.runs.size).toBe(2);
});

test("Test concurrent runs", async () => {
    const tracer = new FakeTracer();
    await tracer.newSession();
    await Promise.all([_testNestedRun(tracer), _testNestedRun(tracer), _testNestedRun(tracer)]);
    expect(tracer.runs.size).toBe(3);
});
