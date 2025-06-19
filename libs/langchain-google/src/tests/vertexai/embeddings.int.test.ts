import { test, expect } from "@jest/globals";
import { VertexAIEmbeddings } from "../../node.js";

test("Test VertexAIEmbeddings.embedQuery", async () => {
  const embeddings = new VertexAIEmbeddings({
    model: "textembedding-gecko",
  });
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
});

const testModelsLocations = [
  ["text-embedding-005", "us-central1"],
  ["text-multilingual-embedding-002", "us-central1"],
  ["text-embedding-005", "europe-west9"],
  ["text-multilingual-embedding-002", "europe-west9"],
];

test.each(testModelsLocations)(
  "VertexAIEmbeddings.embedDocuments %s %s",
  async (model, location) => {
    const embeddings = new VertexAIEmbeddings({
      model,
      location,
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
  }
);
