import { describe, expect, jest, test } from "@jest/globals";
import { Document } from "../../document.js";
import { FakeEmbeddings } from "../../embeddings/fake.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";
import {
  BUFFER_IDX,
  LAST_ACCESSED_AT_KEY,
  TimeWeightedVectorStoreRetriever,
} from "../time_weighted.js";

jest.useFakeTimers();
const mockNow = new Date("2023-04-18 15:30");
jest.setSystemTime(mockNow);

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

describe("Test getRelevantDocuments", () => {
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
    await expect(() => retriever.getRelevantDocuments(query)).rejects.toThrow();
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
    const resultsDocs = await retriever.getRelevantDocuments(query);
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
    const resultsDocs = await retriever.getRelevantDocuments(query);
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
    const resultsDocs = await retriever.getRelevantDocuments(query);
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
    const resultsDocs = await retriever.getRelevantDocuments(query);
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
    const resultsDocs = await retriever.getRelevantDocuments(query);
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
    const resultsDocs = await retriever.getRelevantDocuments(query);
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
    console.log(resultsDocs);
    expect(resultsDocs).toStrictEqual(expected);
  });
});
