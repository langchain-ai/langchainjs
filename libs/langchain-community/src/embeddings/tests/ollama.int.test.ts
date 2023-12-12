import { test, expect } from "@jest/globals";
import { OllamaEmbeddings } from "../ollama.js";

test.skip("Test OllamaEmbeddings.embedQuery", async () => {
  const embeddings = new OllamaEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
});

test.skip("Test OllamaEmbeddings.embedDocuments", async () => {
  const embeddings = new OllamaEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});
