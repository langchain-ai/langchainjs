import { test, expect } from "@jest/globals";
import { GoogleVertexAIEmbeddings } from "../embeddings.js";

test("Test GoogleVertexAIEmbeddings.embedQuery", async () => {
  const embeddings = new GoogleVertexAIEmbeddings({
    model: "textembedding-gecko",
  });
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
});

test("Test GoogleVertexAIEmbeddings.embedDocuments", async () => {
  const embeddings = new GoogleVertexAIEmbeddings({
    model: "text-embedding-004",
  });
  const res = await embeddings.embedDocuments([
    "Hello world",
    "Bye bye",
    "we need",
    "at least",
    "six documents",
    "to test pagination",
  ]);
  // console.log(res);
  expect(res).toHaveLength(6);
  res.forEach((r) => {
    expect(typeof r[0]).toBe("number");
  });
});
