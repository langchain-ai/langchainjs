/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";

import * as pg from "pg";

import { OpenAIEmbeddings } from "../../embeddings/index.js";
import { Document } from "../../document.js";
import { PGVectorStore } from "../pgvector.js";

const { Client } = pg;

test("PGVectorStore with external ids", async () => {
  const client = new Client();
  await client.connect();
  const embeddings = new OpenAIEmbeddings();

  const store = new PGVectorStore(embeddings, { client });

  expect(store).toBeDefined();

  await store.addDocuments([
    { pageContent: "hello", metadata: { a: 1 } },
    { pageContent: "hi", metadata: { a: 1 } },
    { pageContent: "bye", metadata: { a: 1 } },
    { pageContent: "what's this", metadata: { a: 1 } },
  ]);

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(1);

  expect(results).toEqual([
    new Document({ metadata: { a: 1 }, pageContent: "hello" }),
  ]);
});
