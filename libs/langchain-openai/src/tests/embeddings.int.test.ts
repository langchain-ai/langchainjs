import { test, expect } from "@jest/globals";
import { OpenAIEmbeddings } from "../embeddings.js";

test("Test OpenAIEmbeddings.embedQuery", async () => {
  const embeddings = new OpenAIEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
});

test("Test OpenAIEmbeddings.embedDocuments", async () => {
  const embeddings = new OpenAIEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});

test("Test OpenAIEmbeddings concurrency", async () => {
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

test("Test OpenAI embeddings with an invalid org throws", async () => {
  await expect(async () => {
    const model = new OpenAIEmbeddings({
      configuration: {
        organization: "NOT_REAL",
      },
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

test("Test OpenAIEmbeddings.embedQuery with v3 and dimensions", async () => {
  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
    dimensions: 127,
  });
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
  expect(res.length).toBe(127);
});

test("Test OpenAIEmbeddings.embedDocuments with v3 and dimensions", async () => {
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

test("Test OpenAIEmbeddings.embedQuery with encodingFormat", async () => {
  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
    encodingFormat: "float",
  });
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
  expect(res.length).toBe(1536); // Default dimension for text-embedding-3-small
});

test("Test OpenAIEmbeddings.embedDocuments with encodingFormat", async () => {
  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
    encodingFormat: "float",
  });
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
  expect(res[0].length).toBe(1536); // Default dimension for text-embedding-3-small
  expect(res[1].length).toBe(1536);
});

test("Test OpenAIEmbeddings with encodingFormat and custom dimensions", async () => {
  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
    encodingFormat: "float",
    dimensions: 256,
  });
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
  expect(res.length).toBe(256); // Should respect custom dimensions
});
