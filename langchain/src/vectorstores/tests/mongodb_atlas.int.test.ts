/* eslint-disable no-process-env */
/* eslint-disable no-promise-executor-return */

import { test, expect } from "@jest/globals";
import { MongoClient } from "mongodb";
import { CohereEmbeddings } from "../../embeddings/cohere.js";
import { MongoDBAtlasVectorSearch } from "../mongodb_atlas.js";

import { Document } from "../../document.js";

/**
 * The following json can be used to create an index in atlas for cohere embeddings.
 * Use "langchain.test" for the namespace and "default" for the index name.

{
  "mappings": {
    "dynamic": true,
    "fields": {
      "embedding": {
        "dimensions": 1024,
        "similarity": "euclidean",
        "type": "knnVector"
      }
    }
  }
}
*/

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test.skip("MongoDBAtlasVectorSearch with external ids", async () => {
  expect(process.env.MONGODB_ATLAS_URI).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI!);

  try {
    const namespace = "langchain.test";
    const [dbName, collectionName] = namespace.split(".");
    const collection = client.db(dbName).collection(collectionName);

    const vectorStore = new MongoDBAtlasVectorSearch(new CohereEmbeddings(), {
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
    await sleep(2000);
    const results: Document[] = await vectorStore.similaritySearch(
      "Sandwich",
      1
    );

    expect(results).toEqual([
      { pageContent: "What is a sandwich?", metadata: { c: 1 } },
    ]);

    // we can pre filter the search
    const preFilter = {
      range: { lte: 1, path: "e" },
    };

    const filteredResults = await vectorStore.similaritySearch(
      "That fence is purple",
      1,
      preFilter
    );

    expect(filteredResults).toEqual([]);
  } finally {
    await client.close();
  }
});
