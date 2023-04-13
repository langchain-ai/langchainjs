/* eslint-disable no-process-env */
/* eslint-disable no-promise-executor-return */

import { test, expect } from "@jest/globals";
import { MongoClient } from "mongodb";
import { CohereEmbeddings } from "../../embeddings/cohere.js";
import { MongoVectorStore, MongoVectorStoreQueryExtension } from "../mongo.js";

import { Document } from "../../document.js";

/**
 * The following json can be used to create an index in atlas for cohere embeddings:

{
  "mappings": {
    "fields": {
      "embedding": [
        {
          "dimensions": 1024,
          "similarity": "euclidean",
          "type": "knnVector"
        }
      ]
    }
  }
}

 */

test.skip("MongoVectorStore with external ids", async () => {
  expect(process.env.MONGO_URI).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new MongoClient(process.env.MONGO_URI!);

  try {
    const collection = client.db("langchain").collection("test");

    const vectorStore = new MongoVectorStore(new CohereEmbeddings(), {
      client,
      collection,
      // indexName: "default", // make sure that this matches the index name in atlas if not using "default"
    });

    expect(vectorStore).toBeDefined();

    // check if the database is empty
    const count = await collection.countDocuments();

    const justInserted = count === 0;
    if (justInserted) {
      await vectorStore.addDocuments([
        { pageContent: "Dogs are tough.", metadata: { a: 1 } },
        { pageContent: "Cats have fluff.", metadata: { b: 1 } },
        { pageContent: "What is a sandwich?", metadata: { c: 1 } },
        { pageContent: "That fence is purple.", metadata: { d: 1, e: 2 } },
      ]);
    }

    // This test is awkward because the index in atlas takes time to index new documents
    // This means from a fresh insert the query will return nothing
    let triesLeft = 4;

    let results: Document[] = [];
    while (triesLeft > 0) {
      results = await vectorStore.similaritySearch("Sandwich", 1);

      if (justInserted && results.length === 0 && triesLeft > 0) {
        // wait and try again in hopes that the indexing has finished
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      triesLeft -= 1;
    }

    expect(results).toEqual([
      { pageContent: "What is a sandwich?", metadata: { c: 1 } },
    ]);

    // we can filter the search with custom pipeline stages
    const filter: MongoVectorStoreQueryExtension = {
      postQueryPipelineSteps: [
        {
          $match: {
            "metadata.e": { $exists: true },
          },
        },
      ],
    };

    const filteredResults = await vectorStore.similaritySearch(
      "Sandwich",
      4,
      filter
    );

    expect(filteredResults).toEqual([
      { pageContent: "That fence is purple.", metadata: { d: 1, e: 2 } },
    ]);
  } finally {
    await client.close();
  }
});
