import { test, expect, jest } from "@jest/globals";
import * as uuid from "uuid";
import {
  BaseTracer,
  RunV2,
  TracerSessionV2,
  TracerSessionCreateV2,
} from "../handlers/tracers.js";

const TEST_SESSION_ID = `32f2a267-b052-4c45-8c9f-ae5558c94a6a`;
const TENANT_ID = `531d2426-49c4-40f4-b2c7-775aef1db176`;
const _DATE = 1620000000000;

Date.now = jest.fn(() => _DATE);

class FakeTracer extends BaseTracer {
  name = "fake_tracer";

  runs: RunV2[] = [];

  constructor() {
    super();
  }

  protected persistRun(run: RunV2): Promise<void> {
    this.runs.push(run);
    return Promise.resolve();
  }

  protected persistSession(
    session: TracerSessionCreateV2
  ): Promise<TracerSessionV2> {
    return Promise.resolve({
      id: TEST_SESSION_ID,
      ...session,
    });
  }

  async loadSession(sessionName: string): Promise<TracerSessionV2> {
    return Promise.resolve({
      id: TEST_SESSION_ID,
      name: sessionName,
      start_time: _DATE,
      tenant_id: TENANT_ID,
    });
  }

  async loadDefaultSession(): Promise<TracerSessionV2> {
    return Promise.resolve({
      id: TEST_SESSION_ID,
      name: "default",
      start_time: _DATE,
      tenant_id: TENANT_ID,
    });
  }
}

test("Test LLMRun", async () => {
  const tracer = new FakeTracer();
  await tracer.newSession();
  const runId = uuid.v4();
  await tracer.handleLLMStart({ name: "test" }, ["test"], runId);
  await tracer.handleLLMEnd({ generations: [] }, runId);
  expect(tracer.runs.length).toBe(1);
  const run = tracer.runs[0];
  const compareRun: RunV2 = {
    id: runId,
    name: "test",
    start_time: _DATE,
    end_time: _DATE,
    execution_order: 1,
    child_execution_order: 1,
    serialized: { name: "test" },
    session_id: TEST_SESSION_ID,
    inputs: { prompts: ["test"] },
    run_type: "llm",
    outputs: { generations: [] },
    extra: {},
    child_runs: [],
  };
  expect(run).toEqual(compareRun);
});

test("Test LLM Run no start", async () => {
  const tracer = new FakeTracer();
  await tracer.newSession();
  const runId = uuid.v4();
  await expect(tracer.handleLLMEnd({ generations: [] }, runId)).rejects.toThrow(
    "No LLM run to end"
  );
});

test("Test Chain Run", async () => {
  const tracer = new FakeTracer();
  await tracer.newSession();
  const runId = uuid.v4();
  const compareRun: RunV2 = {
    id: runId,
    name: "test",
    start_time: _DATE,
    end_time: _DATE,
    execution_order: 1,
    child_execution_order: 1,
    serialized: { name: "test" },
    session_id: TEST_SESSION_ID,
    inputs: { foo: "bar" },
    outputs: { foo: "bar" },
    run_type: "chain",
    child_runs: [],
    extra: {},
  };
  await tracer.handleChainStart({ name: "test" }, { foo: "bar" }, runId);
  await tracer.handleChainEnd({ foo: "bar" }, runId);
  expect(tracer.runs.length).toBe(1);
  const run = tracer.runs[0];
  expect(run).toEqual(compareRun);
});

test("Test Tool Run", async () => {
  const tracer = new FakeTracer();
  await tracer.newSession();
  const runId = uuid.v4();
  const compareRun: RunV2 = {
    id: runId,
    name: "test",
    start_time: _DATE,
    end_time: _DATE,
    execution_order: 1,
    child_execution_order: 1,
    serialized: { name: "test" },
    session_id: TEST_SESSION_ID.toString(),
    inputs: { input: "test" },
    outputs: { output: "output" },
    run_type: "tool",
    child_runs: [],
    extra: {},
  };
  await tracer.handleToolStart({ name: "test" }, "test", runId);
  await tracer.handleToolEnd("output", runId);
  expect(tracer.runs.length).toBe(1);
  const run = tracer.runs[0];
  expect(run).toEqual(compareRun);
});

test("Test nested runs", async () => {
  const tracer = new FakeTracer();
  await tracer.newSession();
  const chainRunId = uuid.v4();
  const toolRunId = uuid.v4();
  const llmRunId = uuid.v4();
  await tracer.handleChainStart({ name: "test2" }, { foo: "bar" }, chainRunId);
  await tracer.handleToolStart(
    { name: "test_tool" },
    "test",
    toolRunId,
    chainRunId
  );
  await tracer.handleLLMStart(
    { name: "test_llm_child_run" },
    ["test"],
    llmRunId,
    toolRunId
  );
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId);
  await tracer.handleToolEnd("output", toolRunId);
  const llmRunId2 = uuid.v4();
  await tracer.handleLLMStart(
    { name: "test_llm2" },
    ["test"],
    llmRunId2,
    chainRunId
  );
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId2);
  await tracer.handleChainEnd({ foo: "bar" }, chainRunId);
  const compareRun: RunV2 = {
    child_runs: [
      {
        id: toolRunId,
        name: "test_tool",
        parent_run_id: chainRunId,
        child_runs: [
          {
            id: llmRunId,
            name: "test_llm_child_run",
            parent_run_id: toolRunId,
            end_time: 1620000000000,
            execution_order: 3,
            child_execution_order: 3,
            inputs: { prompts: ["test"] },
            outputs: {
              generations: [[]],
            },
            serialized: {
              name: "test_llm_child_run",
            },
            session_id: TEST_SESSION_ID,
            start_time: 1620000000000,
            run_type: "llm",
            child_runs: [],
            extra: {},
          },
        ],
        end_time: 1620000000000,
        execution_order: 2,
        child_execution_order: 3,
        outputs: { output: "output" },
        serialized: {
          name: "test_tool",
        },
        session_id: TEST_SESSION_ID,
        start_time: 1620000000000,
        inputs: { input: "test" },
        run_type: "tool",
        extra: {},
      },
      {
        id: llmRunId2,
        name: "test_llm2",
        parent_run_id: chainRunId,
        end_time: 1620000000000,
        execution_order: 4,
        child_execution_order: 4,
        inputs: { prompts: ["test"] },
        outputs: {
          generations: [[]],
        },
        serialized: {
          name: "test_llm2",
        },
        session_id: TEST_SESSION_ID,
        start_time: 1620000000000,
        run_type: "llm",
        child_runs: [],
        extra: {},
      },
    ],
    id: chainRunId,
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
      name: "test2",
    },
    name: "test2",
    session_id: TEST_SESSION_ID,
    start_time: 1620000000000,
    run_type: "chain",
    extra: {},
  };
  expect(tracer.runs.length).toBe(1);
  expect(tracer.runs[0]).toEqual(compareRun);

  const llmRunId3 = uuid.v4();
  await tracer.handleLLMStart({ name: "test" }, ["test"], llmRunId3);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId3);
  expect(tracer.runs.length).toBe(2);
});
