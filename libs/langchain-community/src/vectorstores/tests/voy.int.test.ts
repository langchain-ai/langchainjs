import { expect, test } from "@jest/globals";
import { Voy as VoyOriginClient } from "voy-search";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { VoyVectorStore } from "../voy.js";

const client = new VoyOriginClient();

test("it can create index using Voy.from text, add new elements to the index and get queried documents", async () => {
  const vectorStore = await VoyVectorStore.fromTexts(
    ["initial first page", "initial second page"],
    [{ id: 1 }, { id: 2 }],
    new OpenAIEmbeddings(),
    client
  );
  // the number of dimensions is produced by OpenAI
  expect(vectorStore.numDimensions).toBe(1536);
  await vectorStore.addDocuments([
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
  ]);
  expect(vectorStore.docstore.length).toBe(5);
  await vectorStore.addDocuments([
    new Document({
      pageContent: "added another first page",
      metadata: { id: 7 },
    }),
  ]);
  const results = await vectorStore.similaritySearchWithScore("added first", 6);
  expect(results.length).toBe(6);
  await vectorStore.delete({
    deleteAll: true,
  });
  const results2 = await vectorStore.similaritySearchWithScore(
    "added first",
    6
  );
  expect(results2.length).toBe(0);
});
