/* eslint-disable no-process-env */
/* eslint-disable no-promise-executor-return */

import { test, expect } from "@jest/globals";
import { Collection, MongoClient } from "mongodb";
import { setTimeout } from "timers/promises";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

import { MongoDBAtlasVectorSearch } from "../vectorstores.js";
import { isUsingLocalAtlas, uri, waitForIndexToBeQueryable } from "./utils.js";

/**
 * The following json can be used to create an index in atlas for Cohere embeddings.
 * Use "langchain.test" for the namespace and "default" for the index name.

{
  "mappings": {
    "fields": {
      "e": { "type": "number" },
      "embedding": {
        "dimensions": 1536,
        "similarity": "euclidean",
        "type": "knnVector"
      }
    }
  }
}
*/

let client: MongoClient;
let collection: Collection;
beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  client = new MongoClient(uri());
  await client.connect();

  const namespace = "vectorstore.test";
  const [dbName, collectionName] = namespace.split(".");
  collection = await client.db(dbName).createCollection(collectionName);

  if (!isUsingLocalAtlas()) return;

  await collection.createSearchIndex({
    name: "default",
    type: "search",
    definition: {
      mappings: {
        fields: {
          e: { type: "number" },
          embedding: {
            dimensions: 1536,
            similarity: "euclidean",
            type: "knnVector",
          },
        },
      },
    },
  });

  await waitForIndexToBeQueryable(collection, "default");
});

beforeEach(async () => {
  await collection.deleteMany({});
});

afterAll(async () => {
  if (isUsingLocalAtlas()) {
    await collection.dropSearchIndex("default");
  }
  await collection.drop({ writeConcern: { w: "majority", wtimeout: 10_000 } });
  await client.close();
});

test("MongoDBAtlasVectorSearch with external ids", async () => {
  const vectorStore = new MongoDBAtlasVectorSearch(new OpenAIEmbeddings(), {
    collection,
  });

  expect(vectorStore).toBeDefined();

  // check if the database is empty
  await collection.deleteMany({});

  await vectorStore.addDocuments([
    {
      pageContent: "Dogs are tough.",
      metadata: { a: 1, created_at: new Date().toISOString() },
    },
    {
      pageContent: "Cats have fluff.",
      metadata: { b: 1, created_at: new Date().toISOString() },
    },
    {
      pageContent: "What is a sandwich?",
      metadata: { c: 1, created_at: new Date().toISOString() },
    },
    {
      pageContent: "That fence is purple.",
      metadata: { d: 1, e: 2, created_at: new Date().toISOString() },
    },
  ]);

  // we sleep 5 seconds to make sure the index in atlas has replicated the new documents
  await setTimeout(5_000);
  const results: Document[] = await vectorStore.similaritySearch("Sandwich", 1);

  expect(results.length).toEqual(1);
  expect(results).toMatchObject([
    { pageContent: "What is a sandwich?", metadata: { c: 1 } },
  ]);

  // // we can pre filter the search
  // const preFilter = {
  //   e: { $lte: 1 },
  // };

  // const filteredResults = await vectorStore.similaritySearch(
  //   "That fence is purple",
  //   1,
  //   preFilter
  // );

  // expect(filteredResults).toEqual([]);

  // const retriever = vectorStore.asRetriever({
  //   filter: {
  //     preFilter,
  //   },
  // });

  // const docs = await retriever.getRelevantDocuments("That fence is purple");
  // expect(docs).toEqual([]);
});

test("MongoDBAtlasVectorSearch with Maximal Marginal Relevance", async () => {
  const texts = ["foo", "foo", "foy"];
  const vectorStore = await MongoDBAtlasVectorSearch.fromTexts(
    texts,
    {},
    new OpenAIEmbeddings(),
    { collection, indexName: "default" }
  );

  // we sleep 5 seconds to make sure the index in atlas has replicated the new documents
  await setTimeout(5000);

  const output = await vectorStore.maxMarginalRelevanceSearch("foo", {
    k: 10,
    fetchK: 20,
    lambda: 0.1,
  });

  expect(output).toHaveLength(texts.length);

  const actual = output.map((doc) => doc.pageContent);
  const expected = ["foo", "foy", "foo"];
  expect(actual).toEqual(expected);

  const standardRetriever = await vectorStore.asRetriever();

  const standardRetrieverOutput = await standardRetriever.getRelevantDocuments(
    "foo"
  );
  expect(output).toHaveLength(texts.length);

  const standardRetrieverActual = standardRetrieverOutput.map(
    (doc) => doc.pageContent
  );
  const standardRetrieverExpected = ["foo", "foo", "foy"];
  expect(standardRetrieverActual).toEqual(standardRetrieverExpected);

  const retriever = await vectorStore.asRetriever({
    searchType: "mmr",
    searchKwargs: {
      fetchK: 20,
      lambda: 0.1,
    },
  });

  const retrieverOutput = await retriever.getRelevantDocuments("foo");
  expect(output).toHaveLength(texts.length);

  const retrieverActual = retrieverOutput.map((doc) => doc.pageContent);
  const retrieverExpected = ["foo", "foy", "foo"];
  expect(retrieverActual).toEqual(retrieverExpected);

  const similarity = await vectorStore.similaritySearchWithScore("foo", 1);
  expect(similarity.length).toBe(1);
});

test("MongoDBAtlasVectorSearch upsert", async () => {
  const vectorStore = new MongoDBAtlasVectorSearch(new OpenAIEmbeddings(), {
    collection,
  });

  expect(vectorStore).toBeDefined();

  // check if the database is empty
  await collection.deleteMany({});

  const ids = await vectorStore.addDocuments([
    { pageContent: "Dogs are tough.", metadata: { a: 1 } },
    { pageContent: "Cats have fluff.", metadata: { b: 1 } },
    { pageContent: "What is a sandwich?", metadata: { c: 1 } },
    { pageContent: "That fence is purple.", metadata: { d: 1, e: 2 } },
  ]);

  // we sleep 5 seconds to make sure the index in atlas has replicated the new documents
  await setTimeout(5000);
  const results: Document[] = await vectorStore.similaritySearch("Sandwich", 1);

  expect(results.length).toEqual(1);
  expect(results).toMatchObject([
    { pageContent: "What is a sandwich?", metadata: { c: 1 } },
  ]);

  await vectorStore.addDocuments([{ pageContent: "upserted", metadata: {} }], {
    ids: [ids[2]],
  });

  // we sleep 5 seconds to make sure the index in atlas has replicated the new documents
  await setTimeout(5000);
  const results2: Document[] = await vectorStore.similaritySearch(
    "Sandwich",
    1
  );
  // console.log(results2);

  expect(results2.length).toEqual(1);
  expect(results2[0].pageContent).not.toContain("sandwich");
});
