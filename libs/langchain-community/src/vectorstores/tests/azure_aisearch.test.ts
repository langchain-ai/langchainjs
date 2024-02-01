/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";
import { SearchIndexingBufferedSender } from "@azure/search-documents";
import { FakeEmbeddings } from "../../utils/testing.js";
import {
  AzureAISearchQueryType,
  AzureAISearchVectorStore,
} from "../azure_aisearch.js";

const embedMock = jest.spyOn(FakeEmbeddings.prototype, "embedDocuments");
const uploadDocumentsMock = jest.spyOn(
  SearchIndexingBufferedSender.prototype,
  "uploadDocuments"
);
const onMock = jest.spyOn(SearchIndexingBufferedSender.prototype, "on");
const flushMock = jest.spyOn(SearchIndexingBufferedSender.prototype, "flush");
const disposeMock = jest.spyOn(
  SearchIndexingBufferedSender.prototype,
  "dispose"
);

beforeEach(() => {
  embedMock.mockClear();
  uploadDocumentsMock.mockClear();
  onMock.mockClear();
  flushMock.mockClear();
  disposeMock.mockClear();
});

test("AzureAISearchVectorStore addVectors should upload documents in batches", async () => {
  const embeddings = new FakeEmbeddings();
  const client = {
    indexDocuments: jest.fn(),
  };

  const store = new AzureAISearchVectorStore(embeddings, {
    client: client as any,
    search: {
      type: "similarity",
    },
  });

  expect(store).toBeDefined();

  const documents = [];
  const vectors: number[][] = [];

  for (let i = 0; i < 1500; i += 1) {
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

  expect(uploadDocumentsMock).toHaveBeenCalledTimes(1);
  expect(flushMock).toHaveBeenCalledTimes(1);
  expect(client.indexDocuments).toHaveBeenCalledTimes(3);
});

test("AzureAISearchVectorStore addDocuments should embed and upload documents in batches", async () => {
  const embeddings = new FakeEmbeddings();
  const client = {
    indexDocuments: jest.fn(),
  };

  const store = new AzureAISearchVectorStore(embeddings, {
    client: client as any,
    search: {
      type: "similarity",
    },
  });

  expect(store).toBeDefined();

  const documents = [];

  for (let i = 0; i < 1500; i += 1) {
    documents.push({
      pageContent: `hello ${i}`,
      metadata: {
        source: `doc-${i}`,
        attributes: [],
      },
    });
  }

  await store.addDocuments(documents);

  expect(embedMock).toHaveBeenCalledTimes(1);
  expect(uploadDocumentsMock).toHaveBeenCalledTimes(1);
  expect(flushMock).toHaveBeenCalledTimes(1);
  expect(client.indexDocuments).toHaveBeenCalledTimes(3);
});

test("AzureAISearchVectorStore addDocuments should use specified IDs", async () => {
  const embeddings = new FakeEmbeddings();
  const client = {
    indexDocuments: jest.fn(),
  };

  const store = new AzureAISearchVectorStore(embeddings, {
    client: client as any,
    search: {
      type: "similarity",
    },
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
      ids: ["id1"],
    }
  );

  expect(uploadDocumentsMock).toHaveBeenCalledTimes(1);
  expect(result).toEqual(["id1"]);
});

test("AzureAISearchVectorStore similarity search works", async () => {
  const search = "test-query";
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
    },
  });

  await store.similaritySearch(search, 1);

  expect(store).toBeDefined();
  expect(client.search.mock.calls[0][0]).toBe("*");
  expect((client.search.mock.calls[0][1] as any).queryType).toBeUndefined();
});

test("AzureAISearchVectorStore similarity hybrid search works", async () => {
  const search = "test-query";
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
    },
  });

  await store.similaritySearch(search, 1);

  expect(store).toBeDefined();
  expect(client.search.mock.calls[0][0]).toBe(search);
  expect((client.search.mock.calls[0][1] as any).queryType).toBeUndefined();
});

test("AzureAISearchVectorStore semantic hybrid search works", async () => {
  const search = "test-query";
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
    },
  });

  await store.similaritySearch(search, 1);

  expect(store).toBeDefined();
  expect(client.search.mock.calls[0][0]).toBe(search);
  expect((client.search.mock.calls[0][1] as any).queryType).toBe("semantic");
});
