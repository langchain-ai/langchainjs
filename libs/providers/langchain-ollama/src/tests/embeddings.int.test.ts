import { test, expect } from "@jest/globals";
import { OllamaEmbeddings } from "../embeddings.js";

test("Test OllamaEmbeddings.embedQuery", async () => {
  const embeddings = new OllamaEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  expect(res).toHaveLength(1024);
  expect(typeof res[0]).toBe("number");
});

test("Test OllamaEmbeddings.embedDocuments", async () => {
  const embeddings = new OllamaEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(res[0]).toHaveLength(1024);
  expect(typeof res[0][0]).toBe("number");
  expect(res[1]).toHaveLength(1024);
  expect(typeof res[1][0]).toBe("number");
});
