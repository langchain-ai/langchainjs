/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";
import { FakeEmbeddings } from "../../utils/testing.js";
import { AzureAISearchQueryType, AzureAISearchVectorStore } from "../azure_aisearch.js";

const embedMock = jest
  .spyOn(FakeEmbeddings.prototype, 'embedDocuments');

beforeEach(() => {
  embedMock.mockClear();
});

test("AzureAISearchVectorStore addVectors should upload at max 100 documents up a time", async () => {
  const embeddings = new FakeEmbeddings();
  const client = {
    search: jest.fn<any>().mockResolvedValue({
      results: [],
    }),
    uploadDocuments: jest.fn(),
  };

  const store = new AzureAISearchVectorStore(embeddings, {
    client: client as any,
    search: {
      type: 'similarity',
    },
    chunkSize: 100,
  });

  expect(store).toBeDefined();

  const documents = [];
  const vectors: number[][] = [];

  for (let i = 0; i < 150; i += 1) {
    vectors.push(await embeddings.embedQuery(`hello ${i}`));
    documents.push({
      pageContent: `hello ${i}`,
      metadata: {
        source: `doc-${i}`,
        attributes: [],
      },
    });
  }

  await store.addVectors(vectors, documents);

  expect(client.uploadDocuments).toHaveBeenCalledTimes(2);
  expect(client.uploadDocuments.mock.calls[0][0]).toHaveLength(100);
  expect(client.uploadDocuments.mock.calls[1][0]).toHaveLength(50);
});

test("AzureAISearchVectorStore addDocuments should embed at max 16 documents up a time", async () => {
  const embeddings = new FakeEmbeddings();
  const client = {
    search: jest.fn<any>().mockResolvedValue({
      results: [],
    }),
    uploadDocuments: jest.fn(),
  };

  const store = new AzureAISearchVectorStore(embeddings, {
    client: client as any,
    search: {
      type: 'similarity',
    },
    embeddingBatchSize: 16,
  });

  expect(store).toBeDefined();

  const documents = [];

  for (let i = 0; i < 30; i += 1) {
    documents.push({
      pageContent: `hello ${i}`,
      metadata: {
        source: `doc-${i}`,
        attributes: [],
      },
    });
  }

  await store.addDocuments(documents);

  expect(embedMock).toHaveBeenCalledTimes(2);
  expect(client.uploadDocuments.mock.calls[0][0]).toHaveLength(16);
  expect(client.uploadDocuments.mock.calls[1][0]).toHaveLength(14);
});

test("AzureAISearchVectorStore addDocuments should use specified IDs", async () => {
  const embeddings = new FakeEmbeddings();
  const client = {
    search: jest.fn<any>().mockResolvedValue({
      results: [],
    }),
    uploadDocuments: jest.fn(),
  };

  const store = new AzureAISearchVectorStore(embeddings, {
    client: client as any,
    search: {
      type: 'similarity',
    }
  });

  expect(store).toBeDefined();

  const result = await store.addDocuments(
    [
      {
        pageContent: "hello",
        metadata: {
          source: "test",
          attributes: [],
        },
      },
    ],
    {
      ids: ["id1"]
    }
  );

  expect(client.uploadDocuments).toHaveBeenCalledTimes(1);
  expect(result).toEqual(["id1"]);
});

test("AzureAISearchVectorStore addDocuments should use generated IDs", async () => {
  const embeddings = new FakeEmbeddings();
  const client = {
    search: jest.fn<any>().mockResolvedValue({
      results: [],
    }),
    uploadDocuments: jest.fn(),
  };

  const store = new AzureAISearchVectorStore(embeddings, {
    client: client as any,
    search: {
      type: 'similarity',
    }
  });

  expect(store).toBeDefined();

  const result = await store.addDocuments(
    [
      {
        pageContent: "hello",
        metadata: {
          source: "test",
          attributes: [],
        },
      },
    ]
  );

  expect(client.uploadDocuments).toHaveBeenCalledTimes(1);
  expect(result).toHaveLength(1);
});

test("AzureAISearchVectorStore similarity search works", async () => {
  const search = 'test-query';
  const embeddings = new FakeEmbeddings();
  const client = {
    search: jest.fn<any>().mockResolvedValue({
      results: [],
    }),
  };

  const store = new AzureAISearchVectorStore(embeddings, {
    client: client as any,
    search: {
      type: AzureAISearchQueryType.Similarity,
    }
  });

  await store.similaritySearch(search, 1);

  expect(store).toBeDefined();
  expect(client.search.mock.calls[0][0]).toBe('*');
  expect((client.search.mock.calls[0][1] as any).queryType).toBeUndefined();
});

test("AzureAISearchVectorStore similarity hybrid search works", async () => {
  const search = 'test-query';
  const embeddings = new FakeEmbeddings();
  const client = {
    search: jest.fn<any>().mockResolvedValue({
      results: [],
    }),
  };

  const store = new AzureAISearchVectorStore(embeddings, {
    client: client as any,
    search: {
      type: AzureAISearchQueryType.SimilarityHybrid,
    }
  });

  await store.similaritySearch(search, 1);

  expect(store).toBeDefined();
  expect(client.search.mock.calls[0][0]).toBe(search);
  expect((client.search.mock.calls[0][1] as any).queryType).toBeUndefined();
});

test("AzureAISearchVectorStore semantic hybrid search works", async () => {
  const search = 'test-query';
  const embeddings = new FakeEmbeddings();
  const client = {
    search: jest.fn<any>().mockResolvedValue({
      results: [],
    }),
  };

  const store = new AzureAISearchVectorStore(embeddings, {
    client: client as any,
    search: {
      type: AzureAISearchQueryType.SemanticHybrid,
    }
  });

  await store.similaritySearch(search, 1);

  expect(store).toBeDefined();
  expect(client.search.mock.calls[0][0]).toBe(search);
  expect((client.search.mock.calls[0][1] as any).queryType).toBe("semantic");
});
