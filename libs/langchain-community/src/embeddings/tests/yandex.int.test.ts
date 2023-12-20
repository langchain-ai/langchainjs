import { test, expect } from "@jest/globals";
import { YandexGPTEmbeddings } from "../yandex.js";

test.skip("Test YandexGPTEmbeddings.embedQuery", async () => {
  const embeddings = new YandexGPTEmbeddings();
  const res = await embeddings.embedQuery("Test query");
  expect(typeof res[0]).toBe("number");
});

test.skip("Test YandexGPTEmbeddings.embedDocuments", async () => {
  const embeddings = new YandexGPTEmbeddings();
  const res = await embeddings.embedDocuments([
    "Test document one",
    "Test document two",
  ]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});
