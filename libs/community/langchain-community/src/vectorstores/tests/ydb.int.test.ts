import { expect, test, beforeAll, afterAll, describe } from "vitest";
import { Driver } from "@ydbjs/core";
import { Document } from "@langchain/core/documents";
import {
  FakeEmbeddings,
  SyntheticEmbeddings,
} from "@langchain/core/utils/testing";
import { YDBVectorStore, YDBSearchStrategy } from "../ydb.js";

const CONNECTION_STRING = "grpc://localhost:2136/local";
const TABLE = `langchain_int_test_${Date.now()}`;
const embeddings = new FakeEmbeddings();

let driver: Driver;

beforeAll(async () => {
  driver = new Driver(CONNECTION_STRING);
  await driver.ready();
});

afterAll(async () => {
  // Best-effort cleanup of the shared table.
  try {
    const store = YDBVectorStore.fromExistingTable(embeddings, {
      driver,
      table: TABLE,
    });
    await store.drop();
  } catch {
    // ignore — table may not exist if an earlier test already dropped it
  }
  driver.close();
});

// ── helpers ──────────────────────────────────────────────────────────

function makeStore(overrides: Record<string, unknown> = {}) {
  return new YDBVectorStore(embeddings, {
    driver,
    table: TABLE,
    ...overrides,
  });
}

// ── tests ────────────────────────────────────────────────────────────

describe("YDBVectorStore integration", () => {
  // ── basic CRUD ───────────────────────────────────────────────────

  test("fromTexts creates store, inserts, and searches", async () => {
    const store = await YDBVectorStore.fromTexts(
      ["cat sat on mat", "dog ran in park", "fish swam in sea"],
      [
        { animal: "cat" },
        { animal: "dog" },
        { animal: "fish" },
      ],
      embeddings,
      { driver, table: TABLE, dropExistingTable: true }
    );

    const results = await store.similaritySearch("cat", 2);
    expect(results.length).toBe(2);
    expect(results[0].pageContent).toBeDefined();
  });

  test("fromDocuments inserts and returns correct content", async () => {
    const docs = [
      new Document({ pageContent: "doc A", metadata: { n: 1 } }),
      new Document({ pageContent: "doc B", metadata: { n: 2 } }),
    ];
    const store = await YDBVectorStore.fromDocuments(docs, embeddings, {
      driver,
      table: TABLE,
      dropExistingTable: true,
    });

    const results = await store.similaritySearch("anything", 2);
    expect(results).toHaveLength(2);
    const contents = results.map((r) => r.pageContent);
    expect(contents).toContain("doc A");
    expect(contents).toContain("doc B");
  });

  test("addDocuments returns IDs and results carry score and metadata", async () => {
    const store = makeStore({ dropExistingTable: true });

    const docs = [
      new Document({
        pageContent: "LangChain is a framework for LLM apps",
        metadata: { source: "docs", lang: "en" },
      }),
      new Document({
        pageContent: "YDB is a distributed database",
        metadata: { source: "docs", lang: "en" },
      }),
      new Document({
        pageContent: "TypeScript is a typed superset of JavaScript",
        metadata: { source: "wiki", lang: "en" },
      }),
    ];

    const ids = await store.addDocuments(docs);
    expect(ids).toHaveLength(3);

    const results = await store.similaritySearchWithScore("database", 2);
    expect(results).toHaveLength(2);

    const [topDoc, topScore] = results[0];
    expect(topDoc.pageContent).toBeDefined();
    expect(typeof topScore).toBe("number");
    expect(topDoc.metadata).toHaveProperty("source");
    expect(topDoc.id).toBeDefined();
  });

  test("explicit document ID is preserved", async () => {
    const store = makeStore({ dropExistingTable: true });

    const ids = await store.addDocuments([
      new Document({
        pageContent: "with explicit id",
        metadata: {},
        id: "my-custom-id",
      }),
      new Document({
        pageContent: "without explicit id",
        metadata: {},
      }),
    ]);

    expect(ids[0]).toBe("my-custom-id");
    expect(ids[1]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    const results = await store.similaritySearch("anything", 10);
    const result = results.find((r) => r.id === "my-custom-id");
    expect(result).toBeDefined();
    expect(result!.pageContent).toBe("with explicit id");
  });

  test("UPSERT replaces existing document on same ID", async () => {
    const store = makeStore({ dropExistingTable: true });

    await store.addDocuments([
      new Document({ pageContent: "original content", metadata: {}, id: "upsert-id" }),
    ]);

    // Insert same ID with different content
    await store.addDocuments([
      new Document({ pageContent: "updated content", metadata: {}, id: "upsert-id" }),
    ]);

    const results = await store.similaritySearch("anything", 10);
    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("updated content");
  });

  test("large batch insert (> 32 documents)", async () => {
    const store = makeStore({ dropExistingTable: true });

    const docs = Array.from({ length: 35 }, (_, i) =>
      new Document({ pageContent: `document ${i}`, metadata: { i } })
    );

    const ids = await store.addDocuments(docs);
    expect(ids).toHaveLength(35);

    const results = await store.similaritySearch("document", 35);
    expect(results).toHaveLength(35);
  });

  test("similaritySearchVectorWithScore with raw vector", async () => {
    const store = makeStore({ dropExistingTable: true });

    await store.addDocuments([
      new Document({ pageContent: "alpha", metadata: {} }),
      new Document({ pageContent: "beta", metadata: {} }),
    ]);

    // FakeEmbeddings produces 4-dimensional vectors
    const queryVector = [0.1, 0.2, 0.3, 0.4];
    const results = await store.similaritySearchVectorWithScore(queryVector, 2);
    expect(results).toHaveLength(2);
    expect(results[0][0]).toBeInstanceOf(Document);
    expect(typeof results[0][1]).toBe("number");
  });

  // ── metadata filter ───────────────────────────────────────────────

  test("metadata filter returns only matching documents", async () => {
    const store = makeStore({ dropExistingTable: true });

    await store.addDocuments([
      new Document({ pageContent: "wiki 1", metadata: { source: "wiki" } }),
      new Document({ pageContent: "wiki 2", metadata: { source: "wiki" } }),
      new Document({ pageContent: "wiki 3", metadata: { source: "wiki" } }),
      new Document({ pageContent: "docs 1", metadata: { source: "docs" } }),
      new Document({ pageContent: "docs 2", metadata: { source: "docs" } }),
    ]);

    const wikiResults = await store.similaritySearch("anything", 10, {
      source: "wiki",
    });
    expect(wikiResults).toHaveLength(3);
    expect(wikiResults.every((r) => r.metadata.source === "wiki")).toBe(true);

    const docsResults = await store.similaritySearch("anything", 10, {
      source: "docs",
    });
    expect(docsResults).toHaveLength(2);
    expect(docsResults.every((r) => r.metadata.source === "docs")).toBe(true);
  });

  test("multi-key metadata filter narrows results correctly", async () => {
    const store = makeStore({ dropExistingTable: true });

    await store.addDocuments([
      new Document({ pageContent: "wiki en", metadata: { source: "wiki", lang: "en" } }),
      new Document({ pageContent: "wiki fr", metadata: { source: "wiki", lang: "fr" } }),
      new Document({ pageContent: "docs en", metadata: { source: "docs", lang: "en" } }),
    ]);

    const results = await store.similaritySearch("anything", 10, {
      source: "wiki",
      lang: "en",
    });
    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("wiki en");
  });

  test("metadata filter with no matches returns empty array", async () => {
    const store = makeStore({ dropExistingTable: true });

    await store.addDocuments([
      new Document({ pageContent: "some doc", metadata: { source: "wiki" } }),
    ]);

    const results = await store.similaritySearch("anything", 10, {
      source: "nonexistent",
    });
    expect(results).toHaveLength(0);
  });

  // ── delete ────────────────────────────────────────────────────────

  test("delete by IDs removes specific documents", async () => {
    const store = makeStore({ dropExistingTable: true });

    const ids = await store.addDocuments([
      new Document({ pageContent: "keep me", metadata: {} }),
      new Document({ pageContent: "delete me", metadata: {} }),
      new Document({ pageContent: "keep me too", metadata: {} }),
    ]);

    await store.delete({ ids: [ids[1]] });

    const results = await store.similaritySearch("anything", 10);
    expect(results).toHaveLength(2);

    const contents = results.map((r) => r.pageContent);
    expect(contents).not.toContain("delete me");
    expect(contents).toContain("keep me");
    expect(contents).toContain("keep me too");
  });

  test("delete all clears the table", async () => {
    const store = makeStore({ dropExistingTable: true });

    await store.addDocuments([
      new Document({ pageContent: "one", metadata: {} }),
      new Document({ pageContent: "two", metadata: {} }),
    ]);

    await store.delete({ deleteAll: true });

    const results = await store.similaritySearch("anything", 10);
    expect(results).toHaveLength(0);
  });

  // ── metadata round-trip ───────────────────────────────────────────

  test("metadata types survive JSON round-trip", async () => {
    const store = makeStore({ dropExistingTable: true });

    await store.addDocuments([
      new Document({
        pageContent: "round-trip",
        metadata: { str: "hello", num: 42, flag: true, nested: { x: 1 } },
      }),
    ]);

    const results = await store.similaritySearch("anything", 1);
    expect(results).toHaveLength(1);
    expect(results[0].metadata).toEqual({
      str: "hello",
      num: 42,
      flag: true,
      nested: { x: 1 },
    });
  });

  // ── auxiliary methods ─────────────────────────────────────────────

  test("fromExistingTable connects without CREATE TABLE", async () => {
    // First create and populate the table
    const store1 = makeStore({ dropExistingTable: true });
    await store1.addDocuments([
      new Document({ pageContent: "persisted", metadata: { key: "val" } }),
    ]);

    // Then connect to the same table without recreating it
    const store2 = YDBVectorStore.fromExistingTable(embeddings, {
      driver,
      table: TABLE,
    });
    const results = await store2.similaritySearch("persisted", 1);
    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("persisted");
    expect(results[0].metadata).toEqual({ key: "val" });
  });

  test("custom column map works", async () => {
    const customTable = `${TABLE}_custom`;
    const store = new YDBVectorStore(embeddings, {
      driver,
      table: customTable,
      dropExistingTable: true,
      columnMap: {
        id: "doc_id",
        document: "doc_text",
        embedding: "doc_vec",
        metadata: "doc_meta",
      },
    });

    await store.addDocuments([
      new Document({ pageContent: "custom columns", metadata: { x: 1 } }),
    ]);

    const results = await store.similaritySearch("custom", 1);
    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("custom columns");
    expect(results[0].metadata).toEqual({ x: 1 });

    await store.drop();
  });

  test("drop removes the table", async () => {
    const tmpTable = `${TABLE}_drop`;
    const store = new YDBVectorStore(embeddings, { driver, table: tmpTable });

    await store.addDocuments([
      new Document({ pageContent: "bye", metadata: {} }),
    ]);

    await store.drop();

    // Recreating the same table should succeed (proves it was dropped)
    const store2 = new YDBVectorStore(embeddings, { driver, table: tmpTable });
    const ids = await store2.addDocuments([
      new Document({ pageContent: "hello again", metadata: {} }),
    ]);
    expect(ids).toHaveLength(1);

    await store2.drop();
  });

  // ── search strategies ─────────────────────────────────────────────

  test("CosineSimilarity returns highest score first (DESC)", async () => {
    // SyntheticEmbeddings produces content-based vectors, so semantically
    // similar texts get closer vectors — unlike FakeEmbeddings which is fixed.
    const synth = new SyntheticEmbeddings({ vectorSize: 4 });
    const store = new YDBVectorStore(synth, {
      driver,
      table: TABLE,
      dropExistingTable: true,
      strategy: YDBSearchStrategy.CosineSimilarity,
    });

    await store.addDocuments([
      new Document({ pageContent: "cat", metadata: {} }),
      new Document({ pageContent: "xyz", metadata: {} }),
    ]);

    const results = await store.similaritySearchWithScore("cat", 2);
    expect(results).toHaveLength(2);
    // Similarity: higher = better → descending
    expect(results[0][1]).toBeGreaterThanOrEqual(results[1][1]);
    // The doc matching the query text should score highest
    expect(results[0][0].pageContent).toBe("cat");
  });

  test("CosineDistance returns lowest score first (ASC)", async () => {
    const synth = new SyntheticEmbeddings({ vectorSize: 4 });
    const store = new YDBVectorStore(synth, {
      driver,
      table: TABLE,
      dropExistingTable: true,
      strategy: YDBSearchStrategy.CosineDistance,
    });

    await store.addDocuments([
      new Document({ pageContent: "cat", metadata: {} }),
      new Document({ pageContent: "xyz", metadata: {} }),
    ]);

    const results = await store.similaritySearchWithScore("cat", 2);
    expect(results).toHaveLength(2);
    // Distance: lower = better → ascending
    expect(results[0][1]).toBeLessThanOrEqual(results[1][1]);
    // The doc matching the query text should have smallest distance
    expect(results[0][0].pageContent).toBe("cat");
  });

  // ── connectionString mode ─────────────────────────────────────────

  test("connectionString mode creates driver internally and close() releases it", async () => {
    const connTable = `${TABLE}_connstr`;
    const store = new YDBVectorStore(embeddings, {
      connectionString: CONNECTION_STRING,
      table: connTable,
    });

    const ids = await store.addDocuments([
      new Document({ pageContent: "via connection string", metadata: {} }),
    ]);
    expect(ids).toHaveLength(1);

    const results = await store.similaritySearch("anything", 1);
    expect(results[0].pageContent).toBe("via connection string");

    await store.drop();
    store.close(); // releases the internally-created driver
  });

  // ── vector index ──────────────────────────────────────────────────

  test("createVectorIndex builds index and search uses it", async () => {
    const indexTable = `${TABLE}_index`;
    const store = new YDBVectorStore(embeddings, {
      driver,
      table: indexTable,
      dropExistingTable: true,
      indexEnabled: true,
      indexName: "test_vec_idx",
      vectorDimension: 4,
    });

    await store.addDocuments([
      new Document({ pageContent: "indexed alpha", metadata: {} }),
      new Document({ pageContent: "indexed beta", metadata: {} }),
      new Document({ pageContent: "indexed gamma", metadata: {} }),
    ]);

    await store.createVectorIndex();

    // Insert more documents after the index is built
    await store.addDocuments([
      new Document({ pageContent: "indexed delta", metadata: {} }),
      new Document({ pageContent: "indexed epsilon", metadata: {} }),
    ]);

    const results = await store.similaritySearch("indexed", 4);
    expect(results).toHaveLength(4);
    expect(results[0].pageContent).toBeDefined();

    await store.drop();
  });

  test("createVectorIndex throws when indexEnabled is false", async () => {
    const store = makeStore({ indexEnabled: false });

    await expect(store.createVectorIndex()).rejects.toThrow(
      "indexEnabled is false"
    );
  });

  test("search with filter and indexEnabled throws", async () => {
    const store = makeStore({
      dropExistingTable: true,
      indexEnabled: true,
    });

    await store.addDocuments([
      new Document({ pageContent: "test", metadata: { k: "v" } }),
    ]);

    await expect(
      store.similaritySearchVectorWithScore([0.1, 0.2, 0.3, 0.4], 1, {
        k: "v",
      })
    ).rejects.toThrow("Cannot use metadata filter with vector index enabled");

    await store.drop();
  });
});
