/* eslint-disable no-process-env */
/* eslint-disable no-promise-executor-return */

import { test, expect } from "@jest/globals";
import { MongoClient } from "mongodb";
import { setTimeout } from "timers/promises";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

import { MongoDBAtlasVectorSearch } from "../mongodb_atlas.js";

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

test.skip("MongoDBAtlasVectorSearch with external ids", async () => {
  expect(process.env.MONGODB_ATLAS_URI).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI!);

  try {
    const namespace = "langchain.test";
    const [dbName, collectionName] = namespace.split(".");
    const collection = client.db(dbName).collection(collectionName);

    const vectorStore = new MongoDBAtlasVectorSearch(new OpenAIEmbeddings(), {
      collection,
    });

    expect(vectorStore).toBeDefined();

    // check if the database is empty
    await collection.deleteMany({});

    await vectorStore.addDocuments([
      { pageContent: "Dogs are tough.", metadata: { a: 1 } },
      { pageContent: "Cats have fluff.", metadata: { b: 1 } },
      { pageContent: "What is a sandwich?", metadata: { c: 1 } },
      { pageContent: "That fence is purple.", metadata: { d: 1, e: 2 } },
    ]);

    // we sleep 2 seconds to make sure the index in atlas has replicated the new documents
    await setTimeout(2000);
    const results: Document[] = await vectorStore.similaritySearch(
      "Sandwich",
      1
    );

    expect(results.length).toEqual(1);
    expect(results).toMatchObject([
      { pageContent: "What is a sandwich?", metadata: { c: 1 } },
    ]);

    // we can pre filter the search
    const preFilter = {
      e: { $lte: 1 },
    };

    const filteredResults = await vectorStore.similaritySearch(
      "That fence is purple",
      1,
      preFilter
    );

    expect(filteredResults).toEqual([]);

    const retriever = vectorStore.asRetriever({
      filter: {
        preFilter,
      },
    });

    const docs = await retriever.getRelevantDocuments("That fence is purple");
    expect(docs).toEqual([]);
  } finally {
    await client.close();
  }
});

test.skip("MongoDBAtlasVectorSearch with Maximal Marginal Relevance", async () => {
  expect(process.env.MONGODB_ATLAS_URI).toBeDefined();
  expect(
    process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY
  ).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI!);
  try {
    const namespace = "langchain.test";
    const [dbName, collectionName] = namespace.split(".");
    const collection = client.db(dbName).collection(collectionName);

    await collection.deleteMany({});

    const texts = ["foo", "foo", "foy"];
    const vectorStore = await MongoDBAtlasVectorSearch.fromTexts(
      texts,
      {},
      new OpenAIEmbeddings(),
      { collection, indexName: "default" }
    );

    // we sleep 2 seconds to make sure the index in atlas has replicated the new documents
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

    const standardRetrieverOutput =
      await standardRetriever.getRelevantDocuments("foo");
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
  } finally {
    await client.close();
  }
});
