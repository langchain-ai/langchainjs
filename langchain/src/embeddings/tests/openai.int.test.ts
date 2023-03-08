import { test, expect } from "@jest/globals";
import { OpenAIEmbeddings } from "../openai.js";

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

test("Test OpenAIEmbeddings.embedDocuments, faster with concurrency", async () => {
  const embeddingsNoConcurrency = new OpenAIEmbeddings({
    batchSize: 1,
    concurrency: 1,
  });
  const embeddingsWithConcurrency = new OpenAIEmbeddings({
    batchSize: 1,
    concurrency: 20,
  });
  const texts = Array.from({ length: 20 }, (_, i) => `Hello world ${i}`);

  const startTimeNoConcurrency = Date.now();
  await embeddingsNoConcurrency.embedDocuments(texts);
  const endTimeNoConcurrency = Date.now();

  const startTimeWithConcurrency = Date.now();
  await embeddingsWithConcurrency.embedDocuments(texts);
  const endTimeWithConcurrency = Date.now();

  const timeToEmbedNoConcurrency =
    endTimeNoConcurrency - startTimeNoConcurrency;
  const timeToEmbedWithConcurrency =
    endTimeWithConcurrency - startTimeWithConcurrency;

  expect(
    timeToEmbedNoConcurrency / timeToEmbedWithConcurrency
  ).toBeGreaterThanOrEqual(3);
});
