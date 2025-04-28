/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { AzureOpenAIEmbeddings as OpenAIEmbeddings } from "../../azure/embeddings.js";

test("Test AzureOpenAIEmbeddings.embedQuery", async () => {
  const embeddings = new OpenAIEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
});

test("Test AzureOpenAIEmbeddings.embedDocuments", async () => {
  const embeddings = new OpenAIEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});

test("Test AzureOpenAIEmbeddings concurrency", async () => {
  const embeddings = new OpenAIEmbeddings({
    batchSize: 1,
    maxConcurrency: 2,
  });
  const res = await embeddings.embedDocuments([
    "Hello world",
    "Bye bye",
    "Hello world",
    "Bye bye",
    "Hello world",
    "Bye bye",
  ]);
  expect(res).toHaveLength(6);
  expect(res.find((embedding) => typeof embedding[0] !== "number")).toBe(
    undefined
  );
});

test("Test timeout error thrown from SDK", async () => {
  await expect(async () => {
    const model = new OpenAIEmbeddings({
      timeout: 1,
      maxRetries: 0,
    });
    await model.embedDocuments([
      "Hello world",
      "Bye bye",
      "Hello world",
      "Bye bye",
      "Hello world",
      "Bye bye",
    ]);
  }).rejects.toThrow();
});

test("Test AzureOpenAIEmbeddings.embedQuery with v3 and dimensions", async () => {
  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
    dimensions: 127,
  });
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
  expect(res.length).toBe(127);
});

test("Test AzureOpenAIEmbeddings.embedDocuments with v3 and dimensions", async () => {
  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
    dimensions: 127,
  });
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
  expect(res[0].length).toBe(127);
  expect(res[1].length).toBe(127);
});
