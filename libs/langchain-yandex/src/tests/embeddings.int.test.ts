import { test, expect } from "@jest/globals";
import { YandexGPTEmbeddings } from "../embeddings.js";

test("Test YandexGPTEmbeddings.embedQuery", async () => {
  const embeddings = new YandexGPTEmbeddings({
    maxRetries: 1,
  });
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
});

test("Test YandexGPTEmbeddings.embedDocuments", async () => {
  const embeddings = new YandexGPTEmbeddings({
    maxRetries: 1,
  });
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  res.forEach((r) => {
    expect(typeof r[0]).toBe("number");
  });
});
