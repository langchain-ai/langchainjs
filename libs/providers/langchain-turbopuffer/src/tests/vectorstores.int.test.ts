import { describe, test, expect, beforeEach } from "vitest";
import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { faker } from "@faker-js/faker";
import { Document } from "@langchain/core/documents";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";
import { v4 as uuid } from "uuid";
import { TurbopufferVectorStore } from "../vectorstores.js";

const embeddings = new SyntheticEmbeddings({ vectorSize: 1536 });

function createClient(): Turbopuffer {
  return new Turbopuffer({
    apiKey: process.env.TURBOPUFFER_API_KEY!,
    ...(process.env.TURBOPUFFER_REGION && {
      region: process.env.TURBOPUFFER_REGION,
    }),
  });
}

function createStore(): TurbopufferVectorStore {
  const client = createClient();
  return new TurbopufferVectorStore(embeddings, {
    namespace: client.namespace(`test-${uuid()}`),
  });
}

describe("TurbopufferVectorStore", () => {
  let store: TurbopufferVectorStore;

  beforeEach(() => {
    store = createStore();
  });

  test("accepts namespace configuration", () => {
    expect(store.namespace).toBeDefined();
  });

  test("add and search documents", async () => {
    const pageContent = faker.lorem.sentence(5);
    await store.addDocuments([{ pageContent, metadata: {} }]);

    const results = await store.similaritySearch(pageContent, 1);
    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe(pageContent);
  });

  test("returns document IDs in results", async () => {
    const pageContent = faker.lorem.sentence(5);
    const customId = uuid();
    await store.addDocuments([{ pageContent, metadata: {} }], {
      ids: [customId],
    });

    const results = await store.similaritySearch(pageContent, 1);
    expect(results[0].id).toBe(customId);
  });

  test("delete single document by ID", async () => {
    const pageContent = faker.lorem.sentence(5);
    const ids = await store.addDocuments([{ pageContent, metadata: {} }]);
    await store.delete({ ids });

    const results = await store.similaritySearch(pageContent, 1);
    expect(results).toHaveLength(0);
  });

  test("delete multiple documents by IDs (batch)", async () => {
    const ids = await store.addDocuments([
      { pageContent: "batch doc one", metadata: {} },
      { pageContent: "batch doc two", metadata: {} },
      { pageContent: "batch doc three", metadata: {} },
    ]);
    expect(ids).toHaveLength(3);

    await store.delete({ ids: [ids[0], ids[2]] });

    const results = await store.similaritySearch("batch doc", 10);
    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("batch doc two");
  });

  test("delete all", async () => {
    await store.addDocuments([
      { pageContent: faker.lorem.sentence(), metadata: {} },
      { pageContent: faker.lorem.sentence(), metadata: {} },
    ]);
    await store.delete({ deleteAll: true });

    const results = await store.similaritySearch("test", 10);
    expect(results).toHaveLength(0);
  });

  test("preserves metadata", async () => {
    const pageContent = faker.lorem.sentence(5);
    const metadata = { source: "test", count: 42, active: true };
    await store.addDocuments([{ pageContent, metadata }]);

    const results = await store.similaritySearch(pageContent, 1);
    expect(results[0].metadata.source).toBe("test");
    expect(results[0].metadata.count).toBe(42);
    expect(results[0].metadata.active).toBe(true);
  });

  test("filter search", async () => {
    await store.addDocuments([
      { pageContent: "document one", metadata: { category: "A" } },
      { pageContent: "document two", metadata: { category: "B" } },
    ]);

    const results = await store.similaritySearch("document", 10, [
      "category",
      "Eq",
      "A",
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].metadata.category).toBe("A");
  });

  test("fromTexts", async () => {
    const client = createClient();
    const newStore = await TurbopufferVectorStore.fromTexts(
      ["first text", "second text"],
      [{ index: 0 }, { index: 1 }],
      embeddings,
      { namespace: client.namespace(`test-${uuid()}`) }
    );

    const results = await newStore.similaritySearch("first", 1);
    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe("first text");
    expect(results[0].metadata.index).toBe(0);
  });

  test("fromDocuments", async () => {
    const client = createClient();
    const newStore = await TurbopufferVectorStore.fromDocuments(
      [new Document({ pageContent: "doc one", metadata: { type: "test" } })],
      embeddings,
      { namespace: client.namespace(`test-${uuid()}`) }
    );

    const results = await newStore.similaritySearch("doc", 1);
    expect(results[0].pageContent).toBe("doc one");
  });

  test("handles array metadata", async () => {
    const pageContent = faker.lorem.sentence(5);
    await store.addDocuments([
      { pageContent, metadata: { tags: ["a", "b", "c"] } },
    ]);

    const results = await store.similaritySearch(pageContent, 1);
    expect(results[0].metadata.tags).toEqual(["a", "b", "c"]);
  });

  test("respects batchSize option", async () => {
    const docs = Array.from({ length: 5 }, (_, i) => ({
      pageContent: `doc ${i}`,
      metadata: { index: i },
    }));

    const ids = await store.addDocuments(docs, { batchSize: 2 });
    expect(ids).toHaveLength(5);

    const results = await store.similaritySearch("doc", 10);
    expect(results).toHaveLength(5);
  });
});
