import { test, expect } from "vitest";
import { MixedbreadAIEmbeddings } from "../embeddings.js";

test("Test MixedbreadAIEmbeddings.embedQuery", async () => {
  const mxbai = new MixedbreadAIEmbeddings();
  const res = await mxbai.embedQuery("mixedbread ai");
  expect(typeof res[0]).toBe("number");
});

test("Test MixedbreadAIEmbeddings.embedDocuments", async () => {
  const mxbai = new MixedbreadAIEmbeddings();
  const res = await mxbai.embedDocuments([
    "mischbrot ki gmbh",
    "mixedbread ai inc.",
  ]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});

test("Test MixedbreadAIEmbeddings concurrency", async () => {
  const mxbai = new MixedbreadAIEmbeddings({
    batchSize: 1,
    maxConcurrency: 2,
  });
  const res = await mxbai.embedDocuments([
    "Bread",
    "No bread",
    "Bread again",
    "No bread again",
    "Bread one more time",
    "No bread one more time",
  ]);
  expect(res).toHaveLength(6);
  expect(res.find((embedding) => typeof embedding[0] !== "number")).toBe(
    undefined
  );
});
