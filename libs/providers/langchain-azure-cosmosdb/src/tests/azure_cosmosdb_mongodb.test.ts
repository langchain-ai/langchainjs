/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, test, expect, beforeEach } from "vitest";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { AzureCosmosDBMongoDBVectorStore } from "../azure_cosmosdb_mongodb.js";

// Mock mongodb client
const createMockClient = () => ({
  db: vi.fn<any>().mockReturnValue({
    collectionName: "documents",
    collection: vi.fn<any>().mockReturnValue({
      listIndexes: vi.fn().mockReturnValue({
        toArray: vi.fn().mockReturnValue([
          {
            name: "vectorSearchIndex",
          },
        ]),
      }),
      dropIndex: vi.fn(),
      deleteMany: vi.fn(),
      insertMany: vi.fn().mockImplementation((docs: any) => ({
        insertedIds: docs.map((_: any, i: any) => `id${i}`),
      })),
      aggregate: vi.fn().mockReturnValue({
        map: vi.fn().mockReturnValue({
          toArray: vi
            .fn()
            .mockReturnValue([
              [new Document({ pageContent: "test", metadata: { a: 1 } }), 0.5],
            ]),
        }),
      }),
    }),
    command: vi.fn(),
  }),
  connect: vi.fn(),
  close: vi.fn(),
});

const embedMock = vi.spyOn(FakeEmbeddings.prototype, "embedDocuments");

beforeEach(() => {
  embedMock.mockClear();
});

test("AzureCosmosDBMongoDBVectorStore works", async () => {
  const client = createMockClient();
  const embeddings = new FakeEmbeddings();
  const store = new AzureCosmosDBMongoDBVectorStore(embeddings, {
    client: client as any,
  });

  expect(store).toBeDefined();

  await store.addDocuments([
    {
      pageContent: "test",
      metadata: { a: 1 },
    },
  ]);

  const mockCollection = client.db().collection();

  expect(mockCollection.insertMany).toHaveBeenCalledTimes(1);
  expect(embedMock).toHaveBeenCalledTimes(1);

  const results = await store.similaritySearch("test", 1);

  expect(mockCollection.aggregate).toHaveBeenCalledTimes(1);
  expect(results).toHaveLength(1);
});

test("AzureCosmosDBMongoDBVectorStore manages its index", async () => {
  const client = createMockClient();
  const embeddings = new FakeEmbeddings();
  const store = new AzureCosmosDBMongoDBVectorStore(embeddings, {
    client: client as any,
  });

  const indexExists = await store.checkIndexExists();

  const mockDb = client.db();
  const mockCollection = mockDb.collection();

  expect(mockDb.command).toHaveBeenCalledTimes(1);
  expect(mockCollection.listIndexes).toHaveBeenCalledTimes(1);
  expect(indexExists).toBe(true);

  await store.deleteIndex();

  expect(mockCollection.dropIndex).toHaveBeenCalledTimes(1);
});

test("AzureCosmosDBMongoDBVectorStore deletes documents", async () => {
  const client = createMockClient();
  const embeddings = new FakeEmbeddings();
  const store = new AzureCosmosDBMongoDBVectorStore(embeddings, {
    client: client as any,
  });

  await store.delete();

  const mockCollection = client.db().collection();
  expect(mockCollection.deleteMany).toHaveBeenCalledTimes(1);
  expect(mockCollection.deleteMany).toHaveBeenCalledWith({});

  await store.delete({
    ids: ["123456789012345678901234", "123456789012345678901235"],
  });

  expect(mockCollection.deleteMany).toHaveBeenCalledTimes(2);
  expect(mockCollection.deleteMany.mock.calls[1][0]).toMatchObject({ _id: {} });

  await store.delete({ filter: { a: 1 } });

  expect(mockCollection.deleteMany).toHaveBeenCalledTimes(3);
  expect(mockCollection.deleteMany.mock.calls[2][0]).toMatchObject({ a: 1 });
});

test("AzureCosmosDBMongoDBVectorStore adds vectors", async () => {
  const client = createMockClient();
  const embeddings = new FakeEmbeddings();
  const store = new AzureCosmosDBMongoDBVectorStore(embeddings, {
    client: client as any,
  });

  await store.addVectors(
    [[1, 2, 5]],
    [
      {
        pageContent: "test",
        metadata: { a: 1 },
      },
    ]
  );

  const mockCollection = client.db().collection();
  expect(embedMock).toHaveBeenCalledTimes(0);
  expect(mockCollection.insertMany).toHaveBeenCalledTimes(1);
});

test("AzureCosmosDBMongoDBVectorStore initializes from texts", async () => {
  const client = createMockClient();
  const embeddings = new FakeEmbeddings();
  const store = await AzureCosmosDBMongoDBVectorStore.fromTexts(
    ["test", "hello", "world"],
    {},
    embeddings,
    { client: client as any }
  );

  expect(store).toBeDefined();

  const mockCollection = client.db().collection();
  expect(mockCollection.insertMany).toHaveBeenCalledTimes(1);
  expect(mockCollection.insertMany).toHaveBeenCalledWith([
    {
      textContent: "test",
      vectorContent: [0.1, 0.2, 0.3, 0.4],
    },
    {
      textContent: "hello",
      vectorContent: [0.1, 0.2, 0.3, 0.4],
    },
    {
      textContent: "world",
      vectorContent: [0.1, 0.2, 0.3, 0.4],
    },
  ]);
  expect(embedMock).toHaveBeenCalledTimes(1);
});

test("AzureCosmosDBMongoDBVectorStore initializes from documents", async () => {
  const client = createMockClient();
  const embeddings = new FakeEmbeddings();
  const store = await AzureCosmosDBMongoDBVectorStore.fromDocuments(
    [
      new Document({ pageContent: "house" }),
      new Document({ pageContent: "pool" }),
    ],
    embeddings,
    { client: client as any }
  );

  expect(store).toBeDefined();

  const mockCollection = client.db().collection();
  expect(mockCollection.insertMany).toHaveBeenCalledTimes(1);
  expect(mockCollection.insertMany).toHaveBeenCalledWith([
    {
      textContent: "house",
      vectorContent: [0.1, 0.2, 0.3, 0.4],
    },
    {
      textContent: "pool",
      vectorContent: [0.1, 0.2, 0.3, 0.4],
    },
  ]);
  expect(embedMock).toHaveBeenCalledTimes(1);
});
