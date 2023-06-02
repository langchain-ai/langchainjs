/* eslint-disable no-process-env */
/* eslint-disable import/no-extraneous-dependencies */
import { test, expect } from "@jest/globals";
import { createPool } from "mysql2/promise";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { SingleStoreVectorStore } from "../singlestore.js";
import { Document } from "../../document.js";

test("SingleStoreVectorStore", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();

  const pool = createPool({
    host: process.env.SINGLESTORE_HOST,
    port: Number(process.env.SINGLESTORE_PORT),
    user: process.env.SINGLESTORE_USERNAME,
    password: process.env.SINGLESTORE_PASSWORD,
    database: process.env.SINGLESTORE_DATABASE,
  });
  const vectorStore = await SingleStoreVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    new OpenAIEmbeddings(),
    {
      connectionPool: pool,
      contentColumnName: "cont",
      metadataColumnName: "met",
      vectorColumnName: "vec",
    }
  );
  expect(vectorStore).toBeDefined();

  const results = await vectorStore.similaritySearch("hello world", 1);

  expect(results).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2" },
    }),
  ]);

  await vectorStore.addDocuments([
    new Document({
      pageContent: "Green forest",
      metadata: { id: 4, name: "4" },
    }),
    new Document({
      pageContent: "Green field",
      metadata: { id: 5, name: "5" },
    }),
  ]);

  const results2 = await vectorStore.similaritySearch("forest", 1);

  expect(results2).toEqual([
    new Document({
      pageContent: "Green forest",
      metadata: { id: 4, name: "4" },
    }),
  ]);

  await pool.end();
});
