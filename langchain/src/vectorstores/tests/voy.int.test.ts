import { expect, test } from "@jest/globals";
import { Voy as VoyOriginClient } from "voy-search";
import { Document } from "../../document.js";
import { FakeEmbeddings } from "../../embeddings/fake.js";
import { Voy, VoyClient } from "../voy.js";

const client: VoyClient = new VoyOriginClient();

test("it can create index using Voy.from text, add new elements to the index and get queried documents", async () => {
  const vectorStore = await Voy.fromTexts(
    ["initial first page", "initial second page"],
    [{ id: 1 }, { id: 2 }],
    new FakeEmbeddings(),
    client
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
  expect(results[0][0].metadata.id).toBe(4);
  expect(results[1][0].metadata.id).toBe(6);
});
