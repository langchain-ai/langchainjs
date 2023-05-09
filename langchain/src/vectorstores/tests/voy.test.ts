import { test, expect } from "@jest/globals";
import { Document } from "../../document.js";
import { FakeEmbeddings } from "../../embeddings/fake.js";
import { Voy, VoyClient } from "../voy.js";

const fakeClient: VoyClient = {
  index: ({ embeddings }) => embeddings.map((i) => i.id).join(","),
  search: () => [{ id: "0" }, { id: "1" }],
};

test("it can create index using Voy.from text, add new elements to the index and get queried documents", async () => {
  const vectorStore = await Voy.fromTexts(
    ["initial first page", "initial second page"],
    [{ id: 1 }, { id: 2 }],
    new FakeEmbeddings(),
    fakeClient
  );
  expect(vectorStore.rawIndex).toBe("0,1");
  // the number produced by fake embeddings
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
  expect(vectorStore.rawIndex).toBe("0,1,2,3,4");
  expect(vectorStore.docstore.length).toBe(5);
  const results = await vectorStore.similaritySearchVectorWithScore(
    [1, 0, 0, 0],
    3
  );
  expect(results[0][0].metadata.id).toBe(1);
  expect(results[1][0].metadata.id).toBe(2);
});
