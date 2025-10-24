/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";

import { AzureCosmosDBNoSQLVectorStore } from "../azure_cosmosdb_nosql.js";

const embedMock = jest.spyOn(FakeEmbeddings.prototype, "embedDocuments");

const createMockClient = () => {
  let id = 0;
  const client = {
    databases: {
      createIfNotExists: jest.fn().mockReturnThis(),
      get database() {
        return this;
      },
      containers: {
        createIfNotExists: jest.fn().mockReturnThis(),
        get container() {
          return this;
        },
        items: {
          create: jest.fn().mockImplementation((doc: any) => ({
            // eslint-disable-next-line no-plusplus
            resource: { id: doc.id ?? `${id++}` },
          })),
          query: jest.fn().mockReturnThis(),
          fetchAll: jest.fn().mockImplementation(() => ({
            resources: Array(id)
              .fill(0)
              .map((_, i) => ({ id: i })),
          })),
        },
        item: jest.fn().mockReturnThis(),
        delete: jest.fn(),
      },
    },
  };
  return client;
};

const createDocuments = (n: number) => {
  const documents = [];
  for (let i = 0; i < n; i += 1) {
    documents.push({
      pageContent: `hello ${i}`,
      metadata: {
        source: `doc-${i}`,
        attributes: [],
      },
    });
  }
  return documents;
};

beforeEach(() => {
  embedMock.mockClear();
});

test("AzureCosmosDBNoSQLVectorStore addVectors should store documents", async () => {
  const embeddings = new FakeEmbeddings();
  const client = createMockClient();
  const store = new AzureCosmosDBNoSQLVectorStore(embeddings, {
    client: client as any,
  });

  expect(store).toBeDefined();

  const documents = createDocuments(1500);
  const vectors: number[][] = [];

  for (const doc of documents) {
    vectors.push(await embeddings.embedQuery(doc.pageContent));
  }

  await store.addVectors(vectors, documents);

  expect(client.databases.containers.items.create).toHaveBeenCalledTimes(1500);
});

test("AzureCosmosDBNoSQLVectorStore addDocuments should embed and store documents", async () => {
  const embeddings = new FakeEmbeddings();
  const client = createMockClient();
  const store = new AzureCosmosDBNoSQLVectorStore(embeddings, {
    client: client as any,
  });

  expect(store).toBeDefined();

  const documents = createDocuments(1500);
  await store.addDocuments(documents);

  expect(embedMock).toHaveBeenCalledTimes(1);
  expect(client.databases.containers.items.create).toHaveBeenCalledTimes(1500);
});

test("AzureCosmosDBNoSQLVectorStore addDocuments should use specified IDs", async () => {
  const embeddings = new FakeEmbeddings();
  const client = createMockClient();
  const store = new AzureCosmosDBNoSQLVectorStore(embeddings, {
    client: client as any,
  });

  expect(store).toBeDefined();

  const result = await store.addDocuments([
    {
      pageContent: "hello",
      metadata: {
        source: "test",
        attributes: [],
      },
      id: "id1",
    },
    {
      pageContent: "hello2",
      metadata: {
        source: "test",
        attributes: [],
      },
      id: "id2",
    },
  ]);

  expect(client.databases.containers.items.create).toHaveBeenCalledTimes(2);
  expect(result).toEqual(["id1", "id2"]);
});

test("AzureCosmosDBNoSQLVectorStore deletes documents", async () => {
  const embeddings = new FakeEmbeddings();
  const client = createMockClient();
  const store = new AzureCosmosDBNoSQLVectorStore(embeddings, {
    client: client as any,
  });

  const documents = createDocuments(10);
  await store.addDocuments(documents);

  await store.delete();

  expect(client.databases.containers.delete).toHaveBeenCalledTimes(10);

  await store.delete({ ids: ["0", "1"] });

  expect(client.databases.containers.delete).toHaveBeenCalledTimes(12);

  await store.delete({ filter: "SELECT * FROM c" });

  expect(client.databases.containers.delete).toHaveBeenCalledTimes(22);
});

test("AzureCosmosDBNoSQLVectorStore initializes from texts", async () => {
  const embeddings = new FakeEmbeddings();
  const client = createMockClient();
  const store = await AzureCosmosDBNoSQLVectorStore.fromTexts(
    ["test", "hello", "world"],
    {},
    embeddings,
    { client: client as any }
  );

  expect(store).toBeDefined();

  expect(client.databases.containers.items.create).toHaveBeenCalledTimes(3);
  expect(client.databases.containers.items.create.mock.calls).toEqual([
    [
      {
        text: "test",
        vector: [0.1, 0.2, 0.3, 0.4],
        metadata: {},
      },
    ],
    [
      {
        text: "hello",
        vector: [0.1, 0.2, 0.3, 0.4],
        metadata: {},
      },
    ],
    [
      {
        text: "world",
        vector: [0.1, 0.2, 0.3, 0.4],
        metadata: {},
      },
    ],
  ]);
  expect(embedMock).toHaveBeenCalledTimes(1);
});

test("AzureCosmosDBNoSQLVectorStore initializes from documents", async () => {
  const embeddings = new FakeEmbeddings();
  const client = createMockClient();
  const store = await AzureCosmosDBNoSQLVectorStore.fromDocuments(
    [
      new Document({ pageContent: "house" }),
      new Document({ pageContent: "pool" }),
    ],
    embeddings,
    { client: client as any }
  );

  expect(store).toBeDefined();

  expect(client.databases.containers.items.create).toHaveBeenCalledTimes(2);
  expect(client.databases.containers.items.create.mock.calls).toEqual([
    [
      {
        text: "house",
        vector: [0.1, 0.2, 0.3, 0.4],
        metadata: {},
      },
    ],
    [
      {
        text: "pool",
        vector: [0.1, 0.2, 0.3, 0.4],
        metadata: {},
      },
    ],
  ]);
  expect(embedMock).toHaveBeenCalledTimes(1);
});
