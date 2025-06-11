/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { AzureCosmosDBVectorStore } from "../azure_cosmosdb.js";

// Mock mongodb client
const createMockClient = () => ({
  db: jest.fn<any>().mockReturnValue({
    collectionName: "documents",
    collection: jest.fn<any>().mockReturnValue({
      listIndexes: jest.fn().mockReturnValue({
        toArray: jest.fn().mockReturnValue([
          {
            name: "vectorSearchIndex",
          },
        ]),
      }),
      dropIndex: jest.fn(),
      deleteMany: jest.fn(),
      insertMany: jest.fn().mockImplementation((docs: any) => ({
        insertedIds: docs.map((_: any, i: any) => `id${i}`),
      })),
      aggregate: jest.fn().mockReturnValue({
        map: jest.fn().mockReturnValue({
          toArray: jest
            .fn()
            .mockReturnValue([
              [new Document({ pageContent: "test", metadata: { a: 1 } }), 0.5],
            ]),
        }),
      }),
    }),
    command: jest.fn(),
  }),
  connect: jest.fn(),
  close: jest.fn(),
});

const embedMock = jest.spyOn(FakeEmbeddings.prototype, "embedDocuments");

beforeEach(() => {
  embedMock.mockClear();
});

test("AzureCosmosDBVectorStore works", async () => {
  const client = createMockClient();
  const embeddings = new FakeEmbeddings();
  const store = new AzureCosmosDBVectorStore(embeddings, {
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

test("AzureCosmosDBVectorStore manages its index", async () => {
  const client = createMockClient();
  const embeddings = new FakeEmbeddings();
  const store = new AzureCosmosDBVectorStore(embeddings, {
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

test("AzureCosmosDBVectorStore deletes documents", async () => {
  const client = createMockClient();
  const embeddings = new FakeEmbeddings();
  const store = new AzureCosmosDBVectorStore(embeddings, {
    client: client as any,
  });

  await store.delete();

  const mockCollection = client.db().collection();
  expect(mockCollection.deleteMany).toHaveBeenCalledTimes(1);
  expect(mockCollection.deleteMany).toHaveBeenCalledWith({});

  await store.delete({
    ids: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
  });

  expect(mockCollection.deleteMany).toHaveBeenCalledTimes(2);
  expect(mockCollection.deleteMany.mock.calls[1][0]).toMatchObject({ _id: {} });

  await store.delete({ filter: { a: 1 } });

  expect(mockCollection.deleteMany).toHaveBeenCalledTimes(3);
  expect(mockCollection.deleteMany.mock.calls[2][0]).toMatchObject({ a: 1 });
});

test("AzureCosmosDBVectorStore adds vectors", async () => {
  const client = createMockClient();
  const embeddings = new FakeEmbeddings();
  const store = new AzureCosmosDBVectorStore(embeddings, {
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

test("AzureCosmosDBVectorStore initializes from texts", async () => {
  const client = createMockClient();
  const embeddings = new FakeEmbeddings();
  const store = await AzureCosmosDBVectorStore.fromTexts(
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

test("AzureCosmosDBVectorStore initializes from documents", async () => {
  const client = createMockClient();
  const embeddings = new FakeEmbeddings();
  const store = await AzureCosmosDBVectorStore.fromDocuments(
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
