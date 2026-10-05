import { test, expect, vi } from "vitest";
import { RunnableLambda } from "@langchain/core/runnables";
import { Client, type Dataset, type Example, type Feedback } from "langsmith";
import { runOnDataset } from "../runner_utils.js";

// runOnDataset traces every run with LangChainTracer; keep the tracer but stop
// it posting runs, so the test sends nothing to LangSmith.
vi.mock("@langchain/core/tracers/tracer_langchain", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@langchain/core/tracers/tracer_langchain")
    >();
  class LangChainTracer extends actual.LangChainTracer {
    async onRunCreate(): Promise<void> {}

    async onRunUpdate(): Promise<void> {}

    copyWithTracingConfig(): LangChainTracer {
      return this;
    }
  }
  return { ...actual, LangChainTracer };
});

const timestamp = "2026-01-01T00:00:00.000Z";

const dataset: Dataset = {
  id: "dataset-id",
  name: "arithmetic",
  description: "",
  tenant_id: "tenant-id",
  data_type: "kv",
  created_at: timestamp,
  modified_at: timestamp,
};

const example: Example = {
  id: "example-id",
  dataset_id: dataset.id,
  inputs: { question: "2 + 2" },
  outputs: { answer: "4" },
  created_at: timestamp,
  runs: [],
};

const feedback: Feedback = {
  id: "feedback-id",
  run_id: "run-id",
  key: "exact_match",
  score: 1,
  value: null,
  comment: null,
  correction: null,
  feedback_source: null,
  created_at: timestamp,
  modified_at: timestamp,
};

test("runOnDataset logs each evaluator's result as feedback", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("Unexpected network call"));
  const client = new Client({ apiUrl: "http://localhost:1984" });
  vi.spyOn(client, "readDataset").mockResolvedValue(dataset);
  vi.spyOn(client, "listExamples").mockImplementation(async function* () {
    yield example;
  });
  vi.spyOn(client, "createProject").mockResolvedValue({
    id: "project-id",
    tenant_id: "tenant-id",
    start_time: 0,
  });
  const createFeedback = vi
    .spyOn(client, "createFeedback")
    .mockResolvedValue(feedback);

  const results = await runOnDataset(
    new RunnableLambda({ func: () => ({ answer: "4" }) }),
    dataset.name,
    {
      client,
      projectName: "runner-utils-test",
      evaluators: [
        ({ prediction, reference }) => ({
          key: "exact_match",
          score: prediction?.answer === reference?.answer ? 1 : 0,
        }),
      ],
    }
  );

  expect(createFeedback).toHaveBeenCalledWith(
    expect.any(String),
    "exact_match",
    expect.objectContaining({ score: 1 })
  );
  expect(results.results[example.id].feedback).toEqual([feedback]);
  expect(fetchSpy).not.toHaveBeenCalled();
});
