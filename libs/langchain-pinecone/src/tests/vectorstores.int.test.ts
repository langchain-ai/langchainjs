/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from "@jest/globals";
import { faker } from "@faker-js/faker";
import { Pinecone } from "@pinecone-database/pinecone";
import * as uuid from "uuid";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";
import { Document } from "@langchain/core/documents";
import { PineconeStoreParams, PineconeStore } from "../vectorstores.js";

const PINECONE_SLEEP_LENGTH = 40000;

function sleep(ms: number) {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("PineconeStore", () => {
  let pineconeStore: PineconeStore;
  const testIndexName = process.env.PINECONE_INDEX!;
  let namespaces: string[] = [];

  beforeAll(async () => {
    const embeddings = new SyntheticEmbeddings({
      vectorSize: 1024,
    });

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const pineconeIndex = pinecone.Index(testIndexName);

    const pineconeArgs: PineconeStoreParams = {
      pineconeIndex,
    };

    pineconeStore = new PineconeStore(embeddings, pineconeArgs);
  });

  afterEach(async () => {
    if (namespaces.length) {
      const delAllPromise = namespaces.map((namespace) =>
        pineconeStore.delete({ deleteAll: true, namespace })
      );
      await Promise.all(delAllPromise);
    } else {
      await pineconeStore.delete({ deleteAll: true });
    }
    namespaces = [];
  });

  test("user-provided ids", async () => {
    const documentId = uuid.v4();
    const pageContent = faker.lorem.sentence(5);

    await pineconeStore.addDocuments(
      [{ pageContent, metadata: {} }],
      [documentId]
    );

    await sleep(PINECONE_SLEEP_LENGTH);

    const results = await pineconeStore.similaritySearch(pageContent, 1);

    expect(results).toEqual([
      new Document({ metadata: {}, pageContent, id: documentId }),
    ]);

    await pineconeStore.addDocuments(
      [{ pageContent: `${pageContent} upserted`, metadata: {} }],
      [documentId]
    );
    await sleep(PINECONE_SLEEP_LENGTH);

    const results2 = await pineconeStore.similaritySearch(pageContent, 1);

    expect(results2).toEqual([
      new Document({
        metadata: {},
        pageContent: `${pageContent} upserted`,
        id: documentId,
      }),
    ]);
  });

  test("auto-generated ids", async () => {
    const pageContent = faker.lorem.sentence(5);

    await pineconeStore.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
    ]);

    await sleep(PINECONE_SLEEP_LENGTH);
    const results = await pineconeStore.similaritySearch(pageContent, 1);

    expect(results).toEqual([
      new Document({
        metadata: { foo: "bar" },
        pageContent,
        id: expect.any(String) as any,
      }),
    ]);
  });

  test("metadata filtering", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();

    await pineconeStore.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: "qux" } },
    ]);
    await sleep(PINECONE_SLEEP_LENGTH);
    // If the filter wasn't working, we'd get all 3 documents back
    const results = await pineconeStore.similaritySearch(pageContent, 3, {
      foo: id,
    });

    expect(results).toEqual([
      new Document({
        metadata: { foo: id },
        pageContent,
        id: expect.any(String) as any,
      }),
    ]);
  });

  test("max marginal relevance", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();

    await pineconeStore.addDocuments([
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: id } },
    ]);
    await sleep(PINECONE_SLEEP_LENGTH);
    // If the filter wasn't working, we'd get all 3 documents back
    const results = await pineconeStore.maxMarginalRelevanceSearch(
      pageContent,
      {
        k: 5,
        fetchK: 20,
        filter: { foo: id },
      }
    );

    expect(results.length).toEqual(3);
  });

  test("delete by id", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();

    const ids = await pineconeStore.addDocuments([
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: id } },
    ]);
    await sleep(PINECONE_SLEEP_LENGTH);
    const results = await pineconeStore.similaritySearch(pageContent, 2, {
      foo: id,
    });

    expect(results.length).toEqual(2);

    await pineconeStore.delete({
      ids: ids.slice(0, 1),
    });

    const results2 = await pineconeStore.similaritySearch(pageContent, 2, {
      foo: id,
    });

    expect(results2.length).toEqual(1);
  });

  test("delete all", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();
    const id2 = uuid.v4();

    await pineconeStore.addDocuments(
      [
        { pageContent, metadata: { foo: id } },
        { pageContent, metadata: { foo: id } },
      ],
      {
        ids: [id, id2],
      }
    );
    await sleep(PINECONE_SLEEP_LENGTH);
    const indexStats = await pineconeStore.pineconeIndex.describeIndexStats();
    expect(indexStats.namespaces).toHaveProperty("");
    expect(indexStats.namespaces?.[""].recordCount).toEqual(2);
    const totalRecords = indexStats.totalRecordCount ?? 0;
    expect(totalRecords).toBeGreaterThanOrEqual(2);

    await pineconeStore.delete({
      deleteAll: true,
    });
    await sleep(PINECONE_SLEEP_LENGTH);
    const indexStats2 = await pineconeStore.pineconeIndex.describeIndexStats();
    expect(indexStats2.namespaces).not.toHaveProperty("");
    // The new total records should be less than the previous total records
    const newTotalRecords = indexStats2.totalRecordCount ?? 0;
    expect(newTotalRecords).toBeLessThan(totalRecords);
  });

  test("query based on passed namespace", async () => {
    const pageContent = "Can we make namespaces work!";
    const id1 = uuid.v4();
    const id2 = uuid.v4();
    namespaces = ["test-1", "test-2"];
    await pineconeStore.addDocuments(
      [{ pageContent, metadata: { foo: id1 } }],
      {
        namespace: namespaces[0],
      }
    );
    await pineconeStore.addDocuments(
      [{ pageContent, metadata: { foo: id2 } }],
      {
        namespace: namespaces[1],
      }
    );
    await sleep(PINECONE_SLEEP_LENGTH);
    const results = await pineconeStore.similaritySearch(pageContent, 1, {
      namespace: namespaces[0],
    });
    expect(results.length).toEqual(1);
    expect(results[0].metadata.foo).toBe(id1);
  });

  test("auto instantiated pinecone index class", async () => {
    const documentId = uuid.v4();
    const pageContent = faker.lorem.sentence(5);
    const embeddings = new SyntheticEmbeddings({
      vectorSize: 1024,
    });

    const store = new PineconeStore(embeddings, {
      pineconeConfig: {
        indexName: testIndexName,
        config: {
          apiKey: process.env.PINECONE_API_KEY!,
        },
      },
    });

    await store.addDocuments([{ pageContent, metadata: {} }], [documentId]);
    await sleep(PINECONE_SLEEP_LENGTH);

    const results = await store.similaritySearch(pageContent, 1);

    expect(results).toEqual([
      new Document({ metadata: {}, pageContent, id: documentId }),
    ]);

    await store.addDocuments(
      [{ pageContent: `${pageContent} upserted`, metadata: {} }],
      [documentId]
    );
    await sleep(PINECONE_SLEEP_LENGTH);

    const results2 = await store.similaritySearch(pageContent, 1);

    expect(results2).toEqual([
      new Document({
        metadata: {},
        pageContent: `${pageContent} upserted`,
        id: documentId,
      }),
    ]);
  });
});
