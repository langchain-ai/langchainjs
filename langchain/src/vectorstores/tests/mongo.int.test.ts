import { test, expect } from "@jest/globals";
import { MongoClient } from "mongodb";

import { FakeEmbeddings } from "../../embeddings/index.js";
// import { OpenAIEmbeddings } from "../../embeddings/index.js";
import { MongoVectorStore } from "../mongo.js";

test("MongoVectorStore with external ids", async () => {
  expect(process.env.MONGO_URI).toBeDefined();

  const client = new MongoClient(process.env.MONGO_URI!);

  const collection = client.db("langchain").collection("test");

  const vectorStore = new MongoVectorStore(
    // new OpenAIEmbeddings(),
    new FakeEmbeddings(),
    { client, collection }
  );

  expect(vectorStore).toBeDefined();

  // await vectorStore.addDocuments([
  //   { pageContent: "Dogs are tough.", metadata: { a: 1 } },
  //   { pageContent: "Cats have fluff.", metadata: { a: 1 } },
  //   { pageContent: "What is a sandwich?", metadata: { a: 1 } },
  //   { pageContent: "That fence is purple.", metadata: { a: 1 } },
  // ]);

  // This test is akward because the index in atlas takes time to index new documents
  // This means from a fresh insert the query will return nothing or something that was already there

  const results = await vectorStore.similaritySearch("Anything", 1);

  expect(results).toHaveLength(1);

  // disconnect
  await client.close();
});
