import { test, expect } from "@jest/globals";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { LlamaCppEmbeddings } from "../llama_cpp.js";

const llamaPath = getEnvironmentVariable("LLAMA_PATH")!;

test.skip("Test LlamaCppEmbeddings.embedQuery", async () => {
  const embeddings = await LlamaCppEmbeddings.initialize({
    modelPath: llamaPath,
  });
  const res = await embeddings.embedQuery("Hello Llama");
  expect(typeof res[0]).toBe("number");
  // Embedding vectors should have a fixed size (typically 384 for small models, 768 for base, etc.)
  // and should be much larger than token count
  expect(res.length).toBeGreaterThan(100);
});

test.skip("Test LlamaCppEmbeddings.embedDocuments", async () => {
  const embeddings = await LlamaCppEmbeddings.initialize({
    modelPath: llamaPath,
  });
  const res = await embeddings.embedDocuments(["Hello Llama", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
  // All embedding vectors should have the same fixed dimension
  expect(res[0].length).toBe(res[1].length);
  expect(res[0].length).toBeGreaterThan(100);
});

test.skip("Test LlamaCppEmbeddings concurrency", async () => {
  const embeddings = await LlamaCppEmbeddings.initialize({
    modelPath: llamaPath,
    batchSize: 1,
  });
  const res = await embeddings.embedDocuments([
    "Hello world",
    "Bye bye",
    "Hello Llama",
    "Bye bye",
    "Hello Panda",
    "Bye bye",
  ]);
  expect(res).toHaveLength(6);
  expect(res.find((embedding) => typeof embedding[0] !== "number")).toBe(
    undefined
  );
  // All embeddings should have the same fixed dimension
  const expectedDimension = res[0].length;
  expect(expectedDimension).toBeGreaterThan(100);
  for (const embedding of res) {
    expect(embedding.length).toBe(expectedDimension);
  }
});
