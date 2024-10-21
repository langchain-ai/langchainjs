import { expect, test } from "@jest/globals";
import { OllamaEmbeddings } from "@langchain/ollama";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import { LibSQLVectorStore, LibSQLVectorStoreArgs } from "../libsql.js";

const client = createClient({
  url: "file:store.db",
});

const config: LibSQLVectorStoreArgs = {
  db: client,
};

describe("LibSQLVectorStore", () => {
  afterAll(async () => {
    await client.close();
    if (fs.existsSync("store.db")) {
      fs.unlinkSync("store.db");
    }
  });

  test("a document with content can be added", async () => {
    client.batch([
      `DROP TABLE IF EXISTS vectors;`,
      `CREATE TABLE IF NOT EXISTS vectors (
        content TEXT,
        metadata JSON,
        embedding F32_BLOB(1024)
      );`,
      `CREATE INDEX IF NOT EXISTS vectors_idx
        ON vectors (libsql_vector_idx(embedding));`,
    ]);

    const store = new LibSQLVectorStore(new OllamaEmbeddings(), config);

    const ids = await store.addDocuments([
      {
        pageContent: "hello",
        metadata: { a: 1 },
      },
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
    client.batch([
      `DROP TABLE IF EXISTS vectors;`,
      `CREATE TABLE IF NOT EXISTS vectors (
        content TEXT,
        metadata JSON,
        embedding F32_BLOB(1024)
      );`,
      `CREATE INDEX IF NOT EXISTS vectors_idx
        ON vectors (libsql_vector_idx(embedding));`,
    ]);

    const store = new LibSQLVectorStore(new OllamaEmbeddings(), config);

    const ids = await store.addDocuments([
      {
        pageContent: "hello world",
        metadata: { a: 1 },
      },
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
    client.batch([
      `DROP TABLE IF EXISTS vectors;`,
      `CREATE TABLE IF NOT EXISTS vectors (
        content TEXT,
        metadata JSON,
        embedding F32_BLOB(1024)
      );`,
      `CREATE INDEX IF NOT EXISTS vectors_idx
        ON vectors (libsql_vector_idx(embedding));`,
    ]);

    const store = new LibSQLVectorStore(new OllamaEmbeddings(), config);

    const ids = await store.addDocuments([
      {
        pageContent: "the quick brown fox",
        metadata: { a: 1 },
      },
      {
        pageContent: "jumped over the lazy dog",
        metadata: { a: 2 },
      },
      {
        pageContent: "hello world",
        metadata: { a: 3 },
      },
    ]);

    expect(ids).toHaveLength(3);
    expect(ids.every((id) => typeof id === "string")).toBe(true);

    const results1 = await store.similaritySearch("the quick brown dog", 2);

    expect(results1).toHaveLength(2);
    expect(results1.map((result) => result.pageContent)).toEqual([
      "the quick brown fox",
      "jumped over the lazy dog",
    ]);
    expect(
      results1.map((result) => result.id).every((id) => typeof id === "string")
    ).toBe(true);

    const results2 = await store.similaritySearch("hello");

    expect(results2).toHaveLength(3);
    expect(results2.map((result) => result.pageContent)).toEqual([
      "hello world",
      "the quick brown fox",
      "jumped over the lazy dog",
    ]);
    expect(
      results2.map((result) => result.id).every((id) => typeof id === "string")
    ).toBe(true);
  });

  test("a document can be deleted by id", async () => {
    client.batch([
      `DROP TABLE IF EXISTS vectors;`,
      `CREATE TABLE IF NOT EXISTS vectors (
        content TEXT,
        metadata JSON,
        embedding F32_BLOB(1024)
      );`,
      `CREATE INDEX IF NOT EXISTS vectors_idx
        ON vectors (libsql_vector_idx(embedding));`,
    ]);

    const store = new LibSQLVectorStore(new OllamaEmbeddings(), config);

    const ids = await store.addDocuments([
      {
        pageContent: "the quick brown fox",
        metadata: { a: 1 },
      },
      {
        pageContent: "jumped over the lazy dog",
        metadata: { a: 2 },
      },
      {
        pageContent: "hello world",
        metadata: { a: 3 },
      },
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
    client.batch([
      `DROP TABLE IF EXISTS vectors;`,
      `CREATE TABLE IF NOT EXISTS vectors (
        content TEXT,
        metadata JSON,
        embedding F32_BLOB(1024)
      );`,
      `CREATE INDEX IF NOT EXISTS vectors_idx
        ON vectors (libsql_vector_idx(embedding));`,
    ]);

    const store = new LibSQLVectorStore(new OllamaEmbeddings(), config);

    const ids = await store.addDocuments([
      {
        pageContent: "the quick brown fox",
        metadata: { a: 1 },
      },
      {
        pageContent: "jumped over the lazy dog",
        metadata: { a: 2 },
      },
      {
        pageContent: "hello world",
        metadata: { a: 3 },
      },
    ]);

    expect(ids).toHaveLength(3);
    expect(ids.every((id) => typeof id === "string")).toBe(true);

    await store.delete({});

    const resultSet = await client.execute(`SELECT * FROM vectors`);

    expect(resultSet.rows).toHaveLength(0);
  });

  test("the table can have a custom id column name", async () => {
    client.batch([
      `DROP TABLE IF EXISTS vectors;`,
      `CREATE TABLE IF NOT EXISTS vectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        metadata JSON,
        embedding F32_BLOB(1024)
      );`,
      `CREATE INDEX IF NOT EXISTS vectors_idx
        ON vectors (libsql_vector_idx(embedding));`,
    ]);

    const store = new LibSQLVectorStore(new OllamaEmbeddings(), config);

    const ids = await store.addDocuments([
      {
        pageContent: "the quick brown fox",
        metadata: { a: 1 },
      },
      {
        pageContent: "jumped over the lazy dog",
        metadata: { a: 2 },
      },
      {
        pageContent: "hello world",
        metadata: { a: 3 },
      },
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
