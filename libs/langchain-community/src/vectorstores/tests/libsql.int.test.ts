/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect, test } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@libsql/client";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";
import fs from "node:fs";
import { LibSQLVectorStore, LibSQLVectorStoreArgs } from "../libsql.js";

test("can create and query (cloud)", async () => {
  const client = createClient({
    url: process.env.LIBSQL_URL!,
    authToken: process.env.LIBSQL_AUTH_TOKEN,
  });
  const vectorStore = new LibSQLVectorStore(
    new OpenAIEmbeddings({
      model: "text-embedding-3-small",
      dimensions: 1536,
    }),
    {
      db: client,
      table: "documents",
      column: "embeddings",
    }
  );
  const ids = await vectorStore.addDocuments([
    new Document({
      pageContent: "added first page",
    }),
    new Document({
      pageContent: "added second page",
    }),
    new Document({
      pageContent: "added third page",
    }),
  ]);
  const nextId = await vectorStore.addDocuments([
    new Document({
      pageContent: "added another first page",
    }),
  ]);
  ids.push(nextId[0]);
  const results = await vectorStore.similaritySearchWithScore("added first", 4);
  expect(results.length).toBe(4);
});

describe("LibSQLVectorStore (local)", () => {
  const client = createClient({
    url: "file:store.db",
  });

  const config: LibSQLVectorStoreArgs = {
    db: client,
  };

  const embeddings = new SyntheticEmbeddings({
    vectorSize: 1024,
  });

  afterAll(async () => {
    await client.close();
    if (fs.existsSync("store.db")) {
      fs.unlinkSync("store.db");
    }
  });

  test("a document with content can be added", async () => {
    await client.batch([
      `DROP TABLE IF EXISTS vectors;`,
      `CREATE TABLE IF NOT EXISTS vectors (
        content TEXT,
        metadata JSON,
        embedding F32_BLOB(1024)
      );`,
      `CREATE INDEX IF NOT EXISTS idx_vectors_embedding
        ON vectors (libsql_vector_idx(embedding));`,
    ]);

    const store = new LibSQLVectorStore(embeddings, config);

    const ids = await store.addDocuments([
      new Document({
        pageContent: "hello",
        metadata: { a: 1 },
      }),
    ]);

    expect(ids).toHaveLength(1);

    const [id] = ids;

    expect(typeof id).toBe("string");

    const resultSet = await client.execute(`SELECT * FROM vectors`);

    expect(resultSet.rows).toHaveLength(1);

    const [row] = resultSet.rows;

    expect(row.content).toBe("hello");
    expect(JSON.parse(row.metadata as string)).toEqual({ a: 1 });
  });

  test("a document with spaces in the content can be added", async () => {
    await client.batch([
      `DROP TABLE IF EXISTS vectors;`,
      `CREATE TABLE IF NOT EXISTS vectors (
        content TEXT,
        metadata JSON,
        embedding F32_BLOB(1024)
      );`,
      `CREATE INDEX IF NOT EXISTS idx_vectors_embedding
        ON vectors (libsql_vector_idx(embedding));`,
    ]);

    const store = new LibSQLVectorStore(embeddings, config);

    const ids = await store.addDocuments([
      new Document({
        pageContent: "hello world",
        metadata: { a: 1 },
      }),
    ]);

    expect(ids).toHaveLength(1);

    const [id] = ids;

    expect(typeof id).toBe("string");

    const resultSet = await client.execute(`SELECT * FROM vectors`);

    expect(resultSet.rows).toHaveLength(1);

    const [row] = resultSet.rows;

    expect(row.content).toBe("hello world");
    expect(JSON.parse(row.metadata as string)).toEqual({ a: 1 });
  });

  test("a similarity search can be performed", async () => {
    await client.batch([
      `DROP TABLE IF EXISTS vectors;`,
      `CREATE TABLE IF NOT EXISTS vectors (
        content TEXT,
        metadata JSON,
        embedding F32_BLOB(1024)
      );`,
      `CREATE INDEX IF NOT EXISTS idx_vectors_embedding
        ON vectors (libsql_vector_idx(embedding));`,
    ]);

    const store = new LibSQLVectorStore(embeddings, config);

    const ids = await store.addDocuments([
      new Document({
        pageContent: "the quick brown fox",
      }),
      new Document({
        pageContent: "jumped over the lazy dog",
      }),
      new Document({
        pageContent: "hello world",
      }),
    ]);

    expect(ids).toHaveLength(3);
    expect(ids.every((id) => typeof id === "string")).toBe(true);

    const results1 = await store.similaritySearch("the quick brown dog", 2);

    expect(results1).toHaveLength(2);
    expect(
      results1.map((result) => result.id).every((id) => typeof id === "string")
    ).toBe(true);

    const results2 = await store.similaritySearch("hello");

    expect(results2).toHaveLength(3);
    expect(
      results2.map((result) => result.id).every((id) => typeof id === "string")
    ).toBe(true);
  });

  test("a similarity search with a filter can be performed", async () => {
    await client.batch([
      `DROP TABLE IF EXISTS vectors;`,
      `CREATE TABLE IF NOT EXISTS vectors (
        content TEXT,
        metadata JSON,
        embedding F32_BLOB(1024)
      );`,
      `CREATE INDEX IF NOT EXISTS idx_vectors_embedding
        ON vectors (libsql_vector_idx(embedding));`,
    ]);

    const store = new LibSQLVectorStore(embeddings, config);

    const ids = await store.addDocuments([
      new Document({
        pageContent: "the quick brown fox",
        metadata: {
          label: "1",
        },
      }),
      new Document({
        pageContent: "jumped over the lazy dog",
        metadata: {
          label: "2",
        },
      }),
      new Document({
        pageContent: "hello world",
        metadata: {
          label: "1",
        },
      }),
    ]);

    expect(ids).toHaveLength(3);
    expect(ids.every((id) => typeof id === "string")).toBe(true);

    const results = await store.similaritySearch("the quick brown dog", 10, {
      label: {
        operator: "=",
        value: "1",
      },
    });

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.pageContent)).toEqual([
      "the quick brown fox",
      "hello world",
    ]);
    expect(
      results.map((result) => result.id).every((id) => typeof id === "string")
    ).toBe(true);
  });

  test("a document can be deleted by id", async () => {
    await client.batch([
      `DROP TABLE IF EXISTS vectors;`,
      `CREATE TABLE IF NOT EXISTS vectors (
        content TEXT,
        metadata JSON,
        embedding F32_BLOB(1024)
      );`,
      `CREATE INDEX IF NOT EXISTS idx_vectors_embedding
        ON vectors (libsql_vector_idx(embedding));`,
    ]);

    const store = new LibSQLVectorStore(embeddings, config);

    const ids = await store.addDocuments([
      new Document({
        pageContent: "the quick brown fox",
      }),
      new Document({
        pageContent: "jumped over the lazy dog",
        metadata: { a: 2 },
      }),
      new Document({
        pageContent: "hello world",
        metadata: { a: 3 },
      }),
    ]);

    expect(ids).toHaveLength(3);
    expect(ids.every((id) => typeof id === "string")).toBe(true);

    const [id1, id2] = ids;

    await store.delete({ ids: [id1, id2] });

    const resultSet = await client.execute(`SELECT * FROM vectors`);

    expect(resultSet.rows).toHaveLength(1);

    const [row] = resultSet.rows;

    expect(row.content).toBe("hello world");
    expect(JSON.parse(row.metadata as string)).toEqual({ a: 3 });
  });

  test("all documents can be deleted", async () => {
    await client.batch([
      `DROP TABLE IF EXISTS vectors;`,
      `CREATE TABLE IF NOT EXISTS vectors (
        content TEXT,
        metadata JSON,
        embedding F32_BLOB(1024)
      );`,
      `CREATE INDEX IF NOT EXISTS idx_vectors_embedding
        ON vectors (libsql_vector_idx(embedding));`,
    ]);

    const store = new LibSQLVectorStore(embeddings, config);

    const ids = await store.addDocuments([
      new Document({
        pageContent: "the quick brown fox",
      }),
      new Document({
        pageContent: "jumped over the lazy dog",
      }),
      new Document({
        pageContent: "hello world",
      }),
    ]);

    expect(ids).toHaveLength(3);
    expect(ids.every((id) => typeof id === "string")).toBe(true);

    await store.delete({
      deleteAll: true,
    });

    const resultSet = await client.execute(`SELECT * FROM vectors`);

    expect(resultSet.rows).toHaveLength(0);
  });

  test("the table can have a custom id column name", async () => {
    await client.batch([
      `DROP TABLE IF EXISTS vectors;`,
      `CREATE TABLE IF NOT EXISTS vectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        metadata JSON,
        embedding F32_BLOB(1024)
      );`,
      `CREATE INDEX IF NOT EXISTS idx_vectors_embedding
        ON vectors (libsql_vector_idx(embedding));`,
    ]);

    const store = new LibSQLVectorStore(embeddings, config);

    const ids = await store.addDocuments([
      new Document({
        pageContent: "the quick brown fox",
        metadata: { a: 1 },
      }),
      new Document({
        pageContent: "jumped over the lazy dog",
        metadata: { a: 2 },
      }),
      new Document({
        pageContent: "hello world",
        metadata: { a: 3 },
      }),
    ]);

    expect(ids).toHaveLength(3);
    expect(ids).toEqual(["1", "2", "3"]);

    const results = await store.similaritySearch("the quick brown dog", 2);

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.pageContent)).toEqual([
      "the quick brown fox",
      "jumped over the lazy dog",
    ]);
    expect(
      results.map((result) => result.id).every((id) => typeof id === "string")
    ).toBe(true);

    const [id1, id2] = ids;

    await store.delete({ ids: [id1, id2] });

    const resultSet = await client.execute(`SELECT * FROM vectors`);

    expect(resultSet.rows).toHaveLength(1);

    const [row] = resultSet.rows;

    expect(row.content).toBe("hello world");
    expect(JSON.parse(row.metadata as string)).toEqual({ a: 3 });
  });
});
