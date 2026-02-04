/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, test, expect, beforeEach, describe } from "vitest";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";

import {
  AzureCosmosDBNoSQLVectorStore,
  AzureCosmosDBNoSQLVectorStoreRetriever,
  AzureCosmosDBNoSQLSearchType,
  AzureCosmosDBNoSQLRetrieverSearchTypes,
} from "../azure_cosmosdb_nosql.js";

const embedMock = vi.spyOn(FakeEmbeddings.prototype, "embedDocuments");

const createMockClient = () => {
  let id = 0;
  const client = {
    databases: {
      createIfNotExists: vi.fn().mockReturnThis(),
      get database() {
        return this;
      },
      containers: {
        createIfNotExists: vi.fn().mockReturnThis(),
        get container() {
          return this;
        },
        items: {
          create: vi.fn().mockImplementation((doc: any) => ({
            resource: { id: doc.id ?? `${id++}` },
          })),
          query: vi.fn().mockReturnThis(),
          fetchAll: vi.fn().mockImplementation(() => ({
            resources: Array(id)
              .fill(0)
              .map((_, i) => ({ id: i })),
          })),
        },
        item: vi.fn().mockReturnThis(),
        delete: vi.fn(),
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

describe("AzureCosmosDBNoSQLSearchType", () => {
  test("should have all expected search types", () => {
    expect(AzureCosmosDBNoSQLSearchType.Vector).toBe("vector");
    expect(AzureCosmosDBNoSQLSearchType.VectorScoreThreshold).toBe(
      "vector_score_threshold"
    );
    expect(AzureCosmosDBNoSQLSearchType.FullTextSearch).toBe(
      "full_text_search"
    );
    expect(AzureCosmosDBNoSQLSearchType.FullTextRanking).toBe(
      "full_text_ranking"
    );
    expect(AzureCosmosDBNoSQLSearchType.Hybrid).toBe("hybrid");
    expect(AzureCosmosDBNoSQLSearchType.HybridScoreThreshold).toBe(
      "hybrid_score_threshold"
    );
  });
});

describe("AzureCosmosDBNoSQLVectorStoreRetriever", () => {
  test("should create a retriever with default search type", () => {
    const embeddings = new FakeEmbeddings();
    const client = createMockClient();
    const store = new AzureCosmosDBNoSQLVectorStore(embeddings, {
      client: client as any,
    });

    const retriever = new AzureCosmosDBNoSQLVectorStoreRetriever({
      vectorStore: store,
    });

    expect(retriever).toBeDefined();
    expect(retriever.cosmosSearchType).toBe("similarity");
    expect(retriever.k).toBe(4);
  });

  test("should create a retriever with custom search type", () => {
    const embeddings = new FakeEmbeddings();
    const client = createMockClient();
    const store = new AzureCosmosDBNoSQLVectorStore(embeddings, {
      client: client as any,
    });

    const retriever = new AzureCosmosDBNoSQLVectorStoreRetriever({
      vectorStore: store,
      searchType: "hybrid",
      k: 10,
    });

    expect(retriever.cosmosSearchType).toBe("hybrid");
    expect(retriever.k).toBe(10);
  });

  test("should throw error for invalid search type", () => {
    const embeddings = new FakeEmbeddings();
    const client = createMockClient();
    const store = new AzureCosmosDBNoSQLVectorStore(embeddings, {
      client: client as any,
    });

    expect(
      () =>
        new AzureCosmosDBNoSQLVectorStoreRetriever({
          vectorStore: store,
          searchType: "invalid" as any,
        })
    ).toThrow(/Invalid search type/);
  });

  test("should have all allowed search types", () => {
    expect(AzureCosmosDBNoSQLRetrieverSearchTypes).toContain("similarity");
    expect(AzureCosmosDBNoSQLRetrieverSearchTypes).toContain("vector");
    expect(AzureCosmosDBNoSQLRetrieverSearchTypes).toContain(
      "vector_score_threshold"
    );
    expect(AzureCosmosDBNoSQLRetrieverSearchTypes).toContain(
      "full_text_search"
    );
    expect(AzureCosmosDBNoSQLRetrieverSearchTypes).toContain(
      "full_text_ranking"
    );
    expect(AzureCosmosDBNoSQLRetrieverSearchTypes).toContain("hybrid");
    expect(AzureCosmosDBNoSQLRetrieverSearchTypes).toContain(
      "hybrid_score_threshold"
    );
    expect(AzureCosmosDBNoSQLRetrieverSearchTypes).toContain("mmr");
  });
});

describe("AzureCosmosDBNoSQLVectorStore utility methods", () => {
  test("getContainer should return the container", async () => {
    const embeddings = new FakeEmbeddings();
    const client = createMockClient();
    const store = new AzureCosmosDBNoSQLVectorStore(embeddings, {
      client: client as any,
    });

    await store.addDocuments([{ pageContent: "test", metadata: {} }]);

    const container = store.getContainer();
    expect(container).toBeDefined();
  });

  test("asCosmosRetriever should create a custom retriever", () => {
    const embeddings = new FakeEmbeddings();
    const client = createMockClient();
    const store = new AzureCosmosDBNoSQLVectorStore(embeddings, {
      client: client as any,
    });

    const retriever = store.asCosmosRetriever({
      searchType: "hybrid",
      k: 10,
      searchKwargs: {
        weights: [0.6, 0.4],
      },
    });

    expect(retriever).toBeInstanceOf(AzureCosmosDBNoSQLVectorStoreRetriever);
    expect(retriever.cosmosSearchType).toBe("hybrid");
    expect(retriever.k).toBe(10);
    expect(retriever.searchKwargs.weights).toEqual([0.6, 0.4]);
  });

  test("asCosmosRetriever with no args should use defaults", () => {
    const embeddings = new FakeEmbeddings();
    const client = createMockClient();
    const store = new AzureCosmosDBNoSQLVectorStore(embeddings, {
      client: client as any,
    });

    const retriever = store.asCosmosRetriever();

    expect(retriever).toBeInstanceOf(AzureCosmosDBNoSQLVectorStoreRetriever);
    expect(retriever.cosmosSearchType).toBe("similarity");
    expect(retriever.k).toBe(4);
  });
});

describe("AzureCosmosDBNoSQLVectorStore factory methods", () => {
  test("fromConnectionStringWithKey should create a store", async () => {
    const embeddings = new FakeEmbeddings();
    const connectionString =
      "AccountEndpoint=https://test.documents.azure.com:443/;AccountKey=test==";

    const store =
      await AzureCosmosDBNoSQLVectorStore.fromConnectionStringWithKey(
        connectionString,
        embeddings
      );

    expect(store).toBeInstanceOf(AzureCosmosDBNoSQLVectorStore);
  });
});
