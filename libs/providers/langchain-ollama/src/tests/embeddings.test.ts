import { test, expect } from "vitest";
import { OllamaEmbeddings } from "../embeddings.js";

test("Test OllamaEmbeddings allows passthrough of request options", async () => {
  const embeddings = new OllamaEmbeddings({
    requestOptions: {
      num_ctx: 1234,
      numPredict: 4321,
    },
  });
  expect(embeddings.requestOptions).toEqual({
    num_ctx: 1234,
    num_predict: 4321,
  });
});

test("Test OllamaEmbeddings dimensions parameter", async () => {
  const embeddings = new OllamaEmbeddings({
    dimensions: 512,
  });
  expect(embeddings.dimensions).toBe(512);
});
