/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";
import { FakeEmbeddings } from "../../embeddings/fake.js";
import { AzureSearchStore } from "../azuresearch.js";

const embedMock = jest
  .spyOn(FakeEmbeddings.prototype, 'embedDocuments');

beforeEach(() => {
  embedMock.mockClear();
});

test("AzureSearch addVectors should upload at max 100 documents up a time", async () => {
  const embeddings = new FakeEmbeddings();
  const client = {
    search: jest.fn<any>().mockResolvedValue({
      results: [],
    }),
    uploadDocuments: jest.fn(),
  };

  const store = await AzureSearchStore.create({
    client: client as any,
    search: {
      type: 'similarity',
    }
  }, embeddings);

  expect(store).toBeDefined();

  const documents = [];
  const vectors: number[][] = [];

  for (let i = 0; i < 150; i++) {
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

test("AzureSearch addDocuments should embed at max 16 documents up a time", async () => {
  const embeddings = new FakeEmbeddings();
  const client = {
    search: jest.fn<any>().mockResolvedValue({
      results: [],
    }),
    uploadDocuments: jest.fn(),
  };

  const store = await AzureSearchStore.create({
    client: client as any,
    search: {
      type: 'similarity',
    }
  }, embeddings);

  expect(store).toBeDefined();

  const documents = [];

  for (let i = 0; i < 30; i++) {
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

test("AzureSearch with external keys", async () => {
  const embeddings = new FakeEmbeddings();
  const client = {
    search: jest.fn<any>().mockResolvedValue({
      results: [],
    }),
    uploadDocuments: jest.fn(),
  };

  const store = await AzureSearchStore.create({
    client: client as any,
    search: {
      type: 'similarity',
    }
  }, embeddings);

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
      keys: ["id1"]
    }
  );

  expect(client.uploadDocuments).toHaveBeenCalledTimes(1);
  expect(result).toEqual(["id1"]);
});

test("AzureSearch with generated keys", async () => {
  const embeddings = new FakeEmbeddings();
  const client = {
    search: jest.fn<any>().mockResolvedValue({
      results: [],
    }),
    uploadDocuments: jest.fn(),
  };

  const store = await AzureSearchStore.create({
    client: client as any,
    search: {
      type: 'similarity',
    }
  }, embeddings);

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

test("AzureSearch with similarity search", async () => {
  const search = 'test-query';
  const embeddings = new FakeEmbeddings();
  const client = {
    search: jest.fn<any>().mockResolvedValue({
      results: [],
    }),
  };

  const store = await AzureSearchStore.create({
    client: client as any,
    search: {
      type: 'similarity',
    }
  }, embeddings);

  await store.similaritySearch(search, 1);

  expect(store).toBeDefined();
  expect(client.search.mock.calls[0][0]).toBe('');
  expect((client.search.mock.calls[0][1] as any).queryType).toBeUndefined();
});

test("AxureSearch with similarity hybrid search", async () => {
  const search = 'test-query';
  const embeddings = new FakeEmbeddings();
  const client = {
    search: jest.fn<any>().mockResolvedValue({
      results: [],
    }),
  };

  const store = await AzureSearchStore.create({
    client: client as any,
    search: {
      type: 'similarity_hybrid',
    }
  }, embeddings);

  await store.similaritySearch(search, 1);

  expect(store).toBeDefined();
  expect(client.search.mock.calls[0][0]).toBe(search);
  expect((client.search.mock.calls[0][1] as any).queryType).toBeUndefined();
});

test("AxureSearch with semantic hybrid search", async () => {
  const search = 'test-query';
  const embeddings = new FakeEmbeddings();
  const client = {
    search: jest.fn<any>().mockResolvedValue({
      results: [],
    }),
  };

  const store = await AzureSearchStore.create({
    client: client as any,
    search: {
      type: 'semantic_hybrid',
    }
  }, embeddings);

  await store.similaritySearch(search, 1);

  expect(store).toBeDefined();
  expect(client.search.mock.calls[0][0]).toBe(search);
  expect((client.search.mock.calls[0][1] as any).queryType).toBe("semantic");
});