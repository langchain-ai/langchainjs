import { expect, test } from "@jest/globals";
import { loadEvaluator } from "../../loader.js";

test("Test Embedding Distance", async () => {
  const chain = await loadEvaluator("embedding_distance");

  const res = await chain.evaluateStrings({
    prediction: "I shall go",
    reference: "I shan't go",
  });

  console.log({ res });
  expect(res.score).toBeGreaterThan(0.09);

  const res1 = await chain.evaluateStrings({
    prediction: "I shall go",
    reference: "I will go",
  });

  expect(res1.score).toBeLessThan(0.04);
  console.log({ res1 });
});

test("Test Pairwise Embedding Distance", async () => {
  const chain = await loadEvaluator("pairwise_embedding_distance");

  const res = await chain.evaluateStringPairs({
    prediction: "I shall go",
    predictionB: "I shan't go",
  });

  expect(res.score).toBeGreaterThan(0.09);
  console.log({ res });
});
