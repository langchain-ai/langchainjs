import { test, expect } from "vitest";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { loadEvaluator } from "../loader.js";
import { EmbeddingDistanceEvalChain } from "../embedding_distance/index.js";

test.each([
  "criteria",
  "labeled_criteria",
  "pairwise_string",
  "labeled_pairwise_string",
  "trajectory",
] as const)("loadEvaluator(%s) requires an llm", async (type) => {
  await expect(loadEvaluator(type, {})).rejects.toThrow(
    `The "${type}" evaluator requires an \`llm\`.`
  );
});

test("loadEvaluator(embedding_distance) does not need an llm", async () => {
  const embedding = new FakeEmbeddings();
  const evaluator = await loadEvaluator("embedding_distance", { embedding });

  expect(evaluator).toBeInstanceOf(EmbeddingDistanceEvalChain);
  expect(evaluator).toMatchObject({ embedding });
});
