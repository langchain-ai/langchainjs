import { test, expect } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "../../utils/testing.js";
import { VoyVectorStore, VoyClient } from "../voy.js";

const fakeClient: VoyClient = {
  index: ({ embeddings }) => embeddings.map((i) => i.id).join(","),
  add: (_) => {},
  search: () => ({
    neighbors: [
      { id: "0", title: "", url: "" },
      { id: "1", title: "", url: "" },
    ],
  }),
  clear: () => {},
};

test("it can create index using Voy.from text, add new elements to the index and get queried documents", async () => {
  const vectorStore = await VoyVectorStore.fromTexts(
    ["initial first page", "initial second page"],
    [{ id: 1 }, { id: 2 }],
    new FakeEmbeddings(),
    fakeClient
  );

  // the number of dimensions is produced by fake embeddings
  expect(vectorStore.numDimensions).toBe(4);
  await vectorStore.addVectors(
    [
      [0, 1, 0, 0],
      [1, 0, 0, 0],
      [0.5, 0.5, 0.5, 0.5],
    ],
    [
      new Document({
        pageContent: "added first page",
        metadata: { id: 5 },
      }),
      new Document({
        pageContent: "added second page",
        metadata: { id: 4 },
      }),
      new Document({
        pageContent: "added third page",
        metadata: { id: 6 },
      }),
    ]
  );
  expect(vectorStore.docstore.length).toBe(5);
  const results = await vectorStore.similaritySearchVectorWithScore(
    [1, 0, 0, 0],
    3
  );
  expect(results[0][0].metadata.id).toBe(1);
  expect(results[1][0].metadata.id).toBe(2);
});
