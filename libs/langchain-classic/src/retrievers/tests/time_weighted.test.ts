import { describe, expect, vi, test } from "vitest";

import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";

import { MemoryVectorStore } from "../../vectorstores/memory.js";
import {
  BUFFER_IDX,
  LAST_ACCESSED_AT_KEY,
  TimeWeightedVectorStoreRetriever,
} from "../time_weighted.js";

vi.useFakeTimers();
const mockNow = new Date("2023-04-18 15:30");
vi.setSystemTime(mockNow);

const getSec = (date: Date) => Math.floor(date.getTime() / 1000);

const getMemoryStream = (): Document[] => [
  {
    pageContent: "foo",
    metadata: {
      [BUFFER_IDX]: 0,
      [LAST_ACCESSED_AT_KEY]: getSec(new Date("2023-04-18 12:00")),
      created_at: getSec(new Date("2023-04-18 12:00")),
    },
  },
  {
    pageContent: "bar",
    metadata: {
      [BUFFER_IDX]: 1,
      [LAST_ACCESSED_AT_KEY]: getSec(new Date("2023-04-18 13:00")),
      created_at: getSec(new Date("2023-04-18 13:00")),
    },
  },
  {
    pageContent: "baz",
    metadata: {
      [BUFFER_IDX]: 2,
      [LAST_ACCESSED_AT_KEY]: getSec(new Date("2023-04-18 11:00")),
      created_at: getSec(new Date("2023-04-18 11:00")),
    },
  },
];

describe("Test invoke", () => {
  test("Should fail on a vector store with documents that have not been added through the addDocuments method on the retriever", async () => {
    const vectorStore = new MemoryVectorStore(new FakeEmbeddings());
    const retriever = new TimeWeightedVectorStoreRetriever({
      vectorStore,
      memoryStream: [],
      searchKwargs: 2,
    });
    await vectorStore.addDocuments([
      { pageContent: "aaa", metadata: {} },
      { pageContent: "aaaa", metadata: {} },
      { pageContent: "bbb", metadata: {} },
    ]);

    const query = "aaa";
    await expect(() => retriever.invoke(query)).rejects.toThrow();
  });
  test("For different pageContent with the same lastAccessedAt, return in descending order of similar words.", async () => {
    const retriever = new TimeWeightedVectorStoreRetriever({
      vectorStore: new MemoryVectorStore(new FakeEmbeddings()),
      memoryStream: [],
      searchKwargs: 2,
    });
    await retriever.addDocuments([
      { pageContent: "aaa", metadata: {} },
      { pageContent: "aaaa", metadata: {} },
      { pageContent: "bbb", metadata: {} },
    ]);

    const query = "aaa";
    const resultsDocs = await retriever.invoke(query);
    const expected = [
      {
        pageContent: "aaa",
        metadata: {
          [BUFFER_IDX]: 0,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(mockNow),
        },
      },
      {
        pageContent: "aaaa",
        metadata: {
          [BUFFER_IDX]: 1,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(mockNow),
        },
      },
      {
        pageContent: "bbb",
        metadata: {
          [BUFFER_IDX]: 2,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(mockNow),
        },
      },
    ];
    expect(resultsDocs).toStrictEqual(expected);
  });

  test("Return in descending order of lastAccessedAt when memoryStream of the same pageContent", async () => {
    const samePageContent = "Test query";
    const samePageContentMemoryStream = getMemoryStream().map((doc) => ({
      ...doc,
      pageContent: samePageContent,
    }));
    const retriever = new TimeWeightedVectorStoreRetriever({
      vectorStore: new MemoryVectorStore(new FakeEmbeddings()),
      memoryStream: samePageContentMemoryStream,
    });
    await retriever.addDocuments([
      { pageContent: samePageContent, metadata: {} },
    ]);

    const query = "Test query";
    const resultsDocs = await retriever.invoke(query);
    const expected = [
      {
        pageContent: samePageContent,
        metadata: {
          [BUFFER_IDX]: 3,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(mockNow),
        },
      },
      {
        pageContent: samePageContent,
        metadata: {
          [BUFFER_IDX]: 1,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(new Date("2023-04-18 13:00")),
        },
      },
      {
        pageContent: samePageContent,
        metadata: {
          [BUFFER_IDX]: 0,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(new Date("2023-04-18 12:00")),
        },
      },
      {
        pageContent: samePageContent,
        metadata: {
          [BUFFER_IDX]: 2,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(new Date("2023-04-18 11:00")),
        },
      },
    ];
    expect(resultsDocs).toStrictEqual(expected);
  });
  test("Return in descending order of lastAccessedAt when memoryStream of different pageContent", async () => {
    const retriever = new TimeWeightedVectorStoreRetriever({
      vectorStore: new MemoryVectorStore(new FakeEmbeddings()),
      memoryStream: getMemoryStream(),
    });
    await retriever.addDocuments([{ pageContent: "qux", metadata: {} }]);

    const query = "Test query";
    const resultsDocs = await retriever.invoke(query);
    const expected = [
      {
        pageContent: "qux",
        metadata: {
          [BUFFER_IDX]: 3,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(mockNow),
        },
      },
      {
        pageContent: "bar",
        metadata: {
          [BUFFER_IDX]: 1,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(new Date("2023-04-18 13:00")),
        },
      },
      {
        pageContent: "foo",
        metadata: {
          [BUFFER_IDX]: 0,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(new Date("2023-04-18 12:00")),
        },
      },
      {
        pageContent: "baz",
        metadata: {
          [BUFFER_IDX]: 2,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(new Date("2023-04-18 11:00")),
        },
      },
    ];
    expect(resultsDocs).toStrictEqual(expected);
  });
  test("Return in descending order of lastAccessedAt when memoryStream of different pageContent and decayRate", async () => {
    const decayRate = 0.5;
    const retriever = new TimeWeightedVectorStoreRetriever({
      vectorStore: new MemoryVectorStore(new FakeEmbeddings()),
      memoryStream: getMemoryStream(),
      decayRate,
    });
    await retriever.addDocuments([{ pageContent: "qux", metadata: {} }]);

    const query = "Test query";
    const resultsDocs = await retriever.invoke(query);
    const expected = [
      {
        pageContent: "qux",
        metadata: {
          [BUFFER_IDX]: 3,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(mockNow),
        },
      },
      {
        pageContent: "bar",
        metadata: {
          [BUFFER_IDX]: 1,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(new Date("2023-04-18 13:00")),
        },
      },
      {
        pageContent: "foo",
        metadata: {
          [BUFFER_IDX]: 0,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(new Date("2023-04-18 12:00")),
        },
      },
      {
        pageContent: "baz",
        metadata: {
          [BUFFER_IDX]: 2,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(new Date("2023-04-18 11:00")),
        },
      },
    ];
    expect(resultsDocs).toStrictEqual(expected);
  });
  test("Return in descending order of lastAccessedAt when memoryStream of different pageContent and k = 3", async () => {
    const retriever = new TimeWeightedVectorStoreRetriever({
      vectorStore: new MemoryVectorStore(new FakeEmbeddings()),
      memoryStream: getMemoryStream(),
      k: 3,
    });
    await retriever.addDocuments([{ pageContent: "qux", metadata: {} }]);

    const query = "Test query";
    const resultsDocs = await retriever.invoke(query);
    const expected = [
      {
        pageContent: "qux",
        metadata: {
          [BUFFER_IDX]: 3,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(mockNow),
        },
      },
      {
        pageContent: "bar",
        metadata: {
          [BUFFER_IDX]: 1,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(new Date("2023-04-18 13:00")),
        },
      },
      {
        pageContent: "baz",
        metadata: {
          [BUFFER_IDX]: 2,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(new Date("2023-04-18 11:00")),
        },
      },
    ];
    expect(resultsDocs).toStrictEqual(expected);
  });
  test("Return in descending order of lastAccessedAt when memoryStream of different pageContent and searchKwargs = 2", async () => {
    const retriever = new TimeWeightedVectorStoreRetriever({
      vectorStore: new MemoryVectorStore(new FakeEmbeddings()),
      memoryStream: getMemoryStream(),
      searchKwargs: 2,
    });
    await retriever.addDocuments([
      { pageContent: "qux", metadata: {} },
      { pageContent: "quux", metadata: {} },
      { pageContent: "corge", metadata: {} },
    ]);

    const query = "Test query";
    const resultsDocs = await retriever.invoke(query);
    const expected = [
      {
        pageContent: "qux",
        metadata: {
          [BUFFER_IDX]: 3,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(mockNow),
        },
      },
      {
        pageContent: "quux",
        metadata: {
          [BUFFER_IDX]: 4,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(mockNow),
        },
      },
      {
        pageContent: "corge",
        metadata: {
          [BUFFER_IDX]: 5,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(mockNow),
        },
      },
      {
        pageContent: "baz",
        metadata: {
          [BUFFER_IDX]: 2,
          [LAST_ACCESSED_AT_KEY]: getSec(mockNow),
          created_at: getSec(new Date("2023-04-18 11:00")),
        },
      },
    ];
    // console.log(resultsDocs);
    expect(resultsDocs).toStrictEqual(expected);
  });
});

describe("Test number of returned documents", () => {
  const contents = ["aaa", "bbb", "ccc", "ddd", "eee", "fff"];

  const createRetriever = async (k?: number) => {
    const retriever = new TimeWeightedVectorStoreRetriever({
      vectorStore: new MemoryVectorStore(new FakeEmbeddings()),
      memoryStream: [],
      k,
    });
    await retriever.addDocuments(
      contents.map((pageContent) => ({ pageContent, metadata: {} }))
    );
    return retriever;
  };

  test.each([1, 2, 3, 5])(
    "Should return exactly k = %i documents",
    async (k) => {
      const retriever = await createRetriever(k);
      const resultsDocs = await retriever.invoke("aaa");
      expect(resultsDocs).toHaveLength(k);
    }
  );

  test("Should return exactly 4 documents by default", async () => {
    const retriever = await createRetriever();
    const resultsDocs = await retriever.invoke("aaa");
    expect(resultsDocs).toHaveLength(4);
  });

  test("Should return no documents when k = 0", async () => {
    const retriever = await createRetriever(0);
    const resultsDocs = await retriever.invoke("aaa");
    expect(resultsDocs).toHaveLength(0);
  });

  test("Should return all documents when k is greater than the number of documents", async () => {
    const retriever = await createRetriever(10);
    const resultsDocs = await retriever.invoke("aaa");
    expect(resultsDocs).toHaveLength(contents.length);
  });
});
