/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import { PineconeClient } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "../../embeddings/index.js";
import { Document } from "../../document.js";

import { PineconeStore } from "../pinecone.js";

test("PineconeStore with external ids", async () => {
  const client = new PineconeClient();

  await client.init({
    environment: process.env.PINECONE_ENVIRONMENT!,
    apiKey: process.env.PINECONE_API_KEY!,
  });

  const index = client.Index(process.env.PINECONE_INDEX!);

  const embeddings = new OpenAIEmbeddings();

  const store = new PineconeStore(index, embeddings);

  expect(store).toBeDefined();

  await store.addDocuments(
    [{ pageContent: "hello", metadata: { a: 1 } }],
    ["id1"]
  );

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(1);

  expect(results).toEqual([
    new Document({ metadata: { a: 1 }, pageContent: "hello" }),
  ]);
});

test("PineconeStore with generated ids", async () => {
  const client = new PineconeClient();

  await client.init({
    environment: process.env.PINECONE_ENVIRONMENT!,
    apiKey: process.env.PINECONE_API_KEY!,
  });

  const index = client.Index(process.env.PINECONE_INDEX!);

  const embeddings = new OpenAIEmbeddings();

  const store = new PineconeStore(index, embeddings);

  expect(store).toBeDefined();

  await store.addDocuments([{ pageContent: "hello", metadata: { a: 1 } }]);

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(1);

  // This assert can fail if the test index is used for other things.
  expect(results).toEqual([
    new Document({ metadata: { a: 1 }, pageContent: "hello" }),
  ]);
});
