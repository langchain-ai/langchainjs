import { test, expect, jest } from "@jest/globals";
import * as uuid from "uuid";
import { Serialized } from "../../load/serializable.js";
import { Document } from "../../documents/document.js";
import { BaseTracer, Run } from "../base.js";
import { HumanMessage } from "../../messages/index.js";

const _DATE = 1620000000000;

Date.now = jest.fn(() => _DATE);

class FakeTracer extends BaseTracer {
  name = "fake_tracer";

  runs: Run[] = [];

  constructor() {
    super();
  }

  protected persistRun(run: Run): Promise<void> {
    this.runs.push(run);
    return Promise.resolve();
  }
}

const serialized: Serialized = {
  lc: 1,
  type: "constructor",
  id: ["test"],
  kwargs: {},
};

test("Test LLMRun", async () => {
  const tracer = new FakeTracer();
  const runId = uuid.v4();
  await tracer.handleLLMStart(serialized, ["test"], runId);
  await tracer.handleLLMEnd({ generations: [] }, runId);
  expect(tracer.runs.length).toBe(1);
  const run = tracer.runs[0];
  const compareRun: Run = {
    id: runId,
    name: "test",
    start_time: _DATE,
    end_time: _DATE,
    execution_order: 1,
    child_execution_order: 1,
    serialized,
    events: [
      {
        name: "start",
        time: "2021-05-03T00:00:00.000Z",
      },
      {
        name: "end",
        time: "2021-05-03T00:00:00.000Z",
      },
    ],
    inputs: { prompts: ["test"] },
    run_type: "llm",
    outputs: { generations: [] },
    child_runs: [],
    extra: {},
    tags: [],
  };
  expect(run).toEqual(compareRun);
});

test("Test Chat Model Run", async () => {
  const tracer = new FakeTracer();
  const runId = uuid.v4();
  const messages = [[new HumanMessage("Avast")]];
  await tracer.handleChatModelStart(serialized, messages, runId);
  await tracer.handleLLMEnd({ generations: [] }, runId);
  expect(tracer.runs.length).toBe(1);
  const run = tracer.runs[0];
  expect(run).toMatchInlineSnapshot(
    {
      id: expect.any(String),
    },
    `
    {
      "child_execution_order": 1,
      "child_runs": [],
      "end_time": 1620000000000,
      "events": [
        {
          "name": "start",
          "time": "2021-05-03T00:00:00.000Z",
        },
        {
          "name": "end",
          "time": "2021-05-03T00:00:00.000Z",
        },
      ],
      "execution_order": 1,
      "extra": {},
      "id": Any<String>,
      "inputs": {
        "messages": [
          [
            {
              "id": [
                "langchain_core",
                "messages",
                "HumanMessage",
              ],
              "kwargs": {
                "additional_kwargs": {},
                "content": "Avast",
              },
              "lc": 1,
              "type": "constructor",
            },
          ],
        ],
      },
      "name": "test",
      "outputs": {
        "generations": [],
      },
      "parent_run_id": undefined,
      "run_type": "llm",
      "serialized": {
        "id": [
          "test",
        ],
        "kwargs": {},
        "lc": 1,
        "type": "constructor",
      },
      "start_time": 1620000000000,
      "tags": [],
    }
  `
  );
});

test("Test LLM Run no start", async () => {
  const tracer = new FakeTracer();
  const runId = uuid.v4();
  await expect(tracer.handleLLMEnd({ generations: [] }, runId)).rejects.toThrow(
    "No LLM run to end"
  );
});

test("Test Chain Run", async () => {
  const tracer = new FakeTracer();
  const runId = uuid.v4();
  const compareRun: Run = {
    id: runId,
    name: "test",
    start_time: _DATE,
    end_time: _DATE,
    execution_order: 1,
    child_execution_order: 1,
    serialized,
    events: [
      {
        name: "start",
        time: "2021-05-03T00:00:00.000Z",
      },
      {
        name: "end",
        time: "2021-05-03T00:00:00.000Z",
      },
    ],
    inputs: { foo: "bar" },
    outputs: { foo: "bar" },
    run_type: "chain",
    child_runs: [],
    extra: {},
    tags: [],
  };
  await tracer.handleChainStart(serialized, { foo: "bar" }, runId);
  await tracer.handleChainEnd({ foo: "bar" }, runId);
  expect(tracer.runs.length).toBe(1);
  const run = tracer.runs[0];
  expect(run).toEqual(compareRun);
});

test("Test Tool Run", async () => {
  const tracer = new FakeTracer();
  const runId = uuid.v4();
  const compareRun: Run = {
    id: runId,
    name: "test",
    start_time: _DATE,
    end_time: _DATE,
    execution_order: 1,
    child_execution_order: 1,
    serialized,
    events: [
      {
        name: "start",
        time: "2021-05-03T00:00:00.000Z",
      },
      {
        name: "end",
        time: "2021-05-03T00:00:00.000Z",
      },
    ],
    inputs: { input: "test" },
    outputs: { output: "output" },
    run_type: "tool",
    child_runs: [],
    extra: {},
    tags: [],
  };
  await tracer.handleToolStart(serialized, "test", runId);
  await tracer.handleToolEnd("output", runId);
  expect(tracer.runs.length).toBe(1);
  const run = tracer.runs[0];
  expect(run).toEqual(compareRun);
});

test("Test Retriever Run", async () => {
  const tracer = new FakeTracer();
  const runId = uuid.v4();
  const document = new Document({
    pageContent: "test",
    metadata: { test: "test" },
  });
  const compareRun: Run = {
    id: runId,
    name: "test",
    start_time: _DATE,
    end_time: _DATE,
    execution_order: 1,
    child_execution_order: 1,
    serialized,
    events: [
      {
        name: "start",
        time: "2021-05-03T00:00:00.000Z",
      },
      {
        name: "end",
        time: "2021-05-03T00:00:00.000Z",
      },
    ],
    inputs: { query: "bar" },
    outputs: { documents: [document] },
    run_type: "retriever",
    child_runs: [],
    extra: {},
    tags: [],
  };

  await tracer.handleRetrieverStart(serialized, "bar", runId);
  await tracer.handleRetrieverEnd([document], runId);
  expect(tracer.runs.length).toBe(1);
  const run = tracer.runs[0];
  expect(run).toEqual(compareRun);
});

test("Test nested runs", async () => {
  const tracer = new FakeTracer();
  const chainRunId = uuid.v4();
  const toolRunId = uuid.v4();
  const llmRunId = uuid.v4();
  await tracer.handleChainStart(serialized, { foo: "bar" }, chainRunId);
  await tracer.handleToolStart(
    { ...serialized, id: ["test_tool"] },
    "test",
    toolRunId,
    chainRunId
  );
  await tracer.handleLLMStart(
    { ...serialized, id: ["test_llm_child_run"] },
    ["test"],
    llmRunId,
    toolRunId
  );
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId);
  await tracer.handleToolEnd("output", toolRunId);
  const llmRunId2 = uuid.v4();
  await tracer.handleLLMStart(
    { ...serialized, id: ["test_llm2"] },
    ["test"],
    llmRunId2,
    chainRunId
  );
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId2);
  await tracer.handleChainEnd({ foo: "bar" }, chainRunId);
  const compareRun: Run = {
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
            serialized: { ...serialized, id: ["test_llm_child_run"] },
            events: [
              {
                name: "start",
                time: "2021-05-03T00:00:00.000Z",
              },
              {
                name: "end",
                time: "2021-05-03T00:00:00.000Z",
              },
            ],
            start_time: 1620000000000,
            run_type: "llm",
            child_runs: [],
            extra: {},
            tags: [],
          },
        ],
        end_time: 1620000000000,
        execution_order: 2,
        child_execution_order: 3,
        outputs: { output: "output" },
        serialized: { ...serialized, id: ["test_tool"] },
        events: [
          {
            name: "start",
            time: "2021-05-03T00:00:00.000Z",
          },
          {
            name: "end",
            time: "2021-05-03T00:00:00.000Z",
          },
        ],
        start_time: 1620000000000,
        inputs: { input: "test" },
        run_type: "tool",
        extra: {},
        tags: [],
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
        serialized: { ...serialized, id: ["test_llm2"] },
        events: [
          {
            name: "start",
            time: "2021-05-03T00:00:00.000Z",
          },
          {
            name: "end",
            time: "2021-05-03T00:00:00.000Z",
          },
        ],
        start_time: 1620000000000,
        run_type: "llm",
        child_runs: [],
        extra: {},
        tags: [],
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
    events: [
      {
        name: "start",
        time: "2021-05-03T00:00:00.000Z",
      },
      {
        name: "end",
        time: "2021-05-03T00:00:00.000Z",
      },
    ],
    name: "test",
    serialized,
    start_time: 1620000000000,
    run_type: "chain",
    extra: {},
    tags: [],
  };
  expect(tracer.runs.length).toBe(1);
  expect(tracer.runs[0]).toEqual(compareRun);

  const llmRunId3 = uuid.v4();
  await tracer.handleLLMStart(serialized, ["test"], llmRunId3);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId3);
  expect(tracer.runs.length).toBe(2);
});
