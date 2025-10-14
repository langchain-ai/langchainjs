import { test, expect } from "vitest";
import { VertexAIEmbeddings } from "../embeddings.js";

test("Test VertexAIEmbeddings.embedDocuments", async () => {
  const embeddings = new VertexAIEmbeddings({
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
