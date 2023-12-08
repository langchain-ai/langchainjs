/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { test, expect } from "@jest/globals";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { LlamaCppEmbeddings } from "../llama_cpp.js";

const llamaPath = getEnvironmentVariable("LLAMA_PATH")!;

test.skip("Test LlamaCppEmbeddings.embedQuery", async () => {
  const embeddings = new LlamaCppEmbeddings({ modelPath: llamaPath });
  const res = await embeddings.embedQuery("Hello Llama");
  expect(typeof res[0]).toBe("number");
});

test.skip("Test LlamaCppEmbeddings.embedDocuments", async () => {
  const embeddings = new LlamaCppEmbeddings({ modelPath: llamaPath });
  const res = await embeddings.embedDocuments(["Hello Llama", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});

test.skip("Test LlamaCppEmbeddings concurrency", async () => {
  const embeddings = new LlamaCppEmbeddings({
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
});
