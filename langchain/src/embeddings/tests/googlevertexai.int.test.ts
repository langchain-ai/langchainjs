import { test, expect } from "@jest/globals";
import { GoogleVertexAIEmbeddings } from "../googlevertexai.js";

test("Test CohereEmbeddings.embedQuery", async () => {
  const embeddings = new GoogleVertexAIEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  console.log(res);
  expect(typeof res[0]).toBe("number");
});

test("Test CohereEmbeddings.embedDocuments", async () => {
  const embeddings = new GoogleVertexAIEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  console.log(res);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
});
