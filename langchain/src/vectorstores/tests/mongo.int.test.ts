import { test, expect } from "@jest/globals";
import { MongoClient } from "mongodb";

// import { OpenAIEmbeddings } from "../../embeddings/index.js";
import { CohereEmbeddings } from "../../embeddings/index.js";
import { MongoVectorStore } from "../mongo.js";

test("MongoVectorStore with external ids", async () => {
  expect(process.env.MONGO_URI).toBeDefined();

  const client = new MongoClient(process.env.MONGO_URI!);

  const collection = client.db("langchain").collection("test");

  const vectorStore = new MongoVectorStore(
    // new OpenAIEmbeddings(), // OpenAI embeddings are too high in dimensionality for atlas
    new CohereEmbeddings(),
    {
      client,
      collection,
      // indexName: "default" // make sure that this matches the index name in atlas if not using "default"
    }
  );

  expect(vectorStore).toBeDefined();

  await vectorStore.addDocuments([
    { pageContent: "Dogs are tough.", metadata: { a: 1 } },
    { pageContent: "Cats have fluff.", metadata: { a: 1 } },
    { pageContent: "What is a sandwich?", metadata: { a: 1 } },
    { pageContent: "That fence is purple.", metadata: { a: 1 } },
  ]);

  // This test is awkward because the index in atlas takes time to index new documents
  // This means from a fresh insert the query will return nothing or something that was already there

  const results = await vectorStore.similaritySearch("Sandwich", 1);

  expect(results).toEqual([
    { pageContent: "What is a sandwich?", metadata: { a: 1 } },
  ]);

  console.log(results);

  // disconnect
  await client.close();
});
