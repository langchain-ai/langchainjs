/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, test, expect } from "vitest";

import { type Collection } from "chromadb";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { Chroma } from "../chroma.js";

const mockCollection = {
  count: vi.fn<Collection["count"]>().mockResolvedValue(5),
  upsert: vi.fn<Collection["upsert"]>().mockResolvedValue(undefined as any),
  delete: vi.fn<Collection["delete"]>().mockResolvedValue(undefined as any),
  // add: vi.fn<Collection["add"]>().mockResolvedValue(undefined as any),
  // modify: vi.fn<Collection["modify"]>().mockResolvedValue(undefined as any),
  // get: vi.fn<Collection["get"]>().mockResolvedValue(undefined as any),
  // update: vi.fn<Collection["update"]>().mockResolvedValue({ success: true }),
  // query: vi.fn<Collection["query"]>().mockResolvedValue(undefined as any),
  // peek: vi.fn<Collection["peek"]>().mockResolvedValue(undefined as any),
} as any;

const mockClient = {
  getOrCreateCollection: vi.fn<any>().mockResolvedValue(mockCollection),
} as any;

describe("Chroma", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("imports correctly", async () => {
    const { ChromaClient } = await Chroma.imports();

    expect(ChromaClient).toBeDefined();
  });

  test("constructor works", async () => {
    const chromaStore = new Chroma(new FakeEmbeddings(), {
      index: mockClient,
      collectionName: "test-collection",
    });

    expect(chromaStore).toBeDefined();
  });

  test("should add vectors to the collection", async () => {
    const expectedPageContents = ["Document 1", "Document 2"];
    const embeddings = new FakeEmbeddings();
    vi.spyOn(embeddings, "embedDocuments");
    const args = {
      collectionName: "testCollection",
      index: mockClient,
      collectionMetadata: { "hnsw:space": "cosine" },
    };
    const documents = expectedPageContents.map((pc) => ({ pageContent: pc }));

    const chroma = new Chroma(embeddings, args);
    await chroma.addDocuments(documents as any);

    expect(mockClient.getOrCreateCollection).toHaveBeenCalled();
    expect(embeddings.embedDocuments).toHaveBeenCalledWith(
      expectedPageContents
    );
    expect(mockCollection.upsert).toHaveBeenCalled();

    const { metadatas } = mockCollection.upsert.mock.calls[0][0];
    expect(metadatas).toEqual([{}, {}]);
  });

  test("should override loc.lines with locFrom/locTo", async () => {
    const expectedPageContents = ["Document 1"];
    const embeddings = new FakeEmbeddings();
    vi.spyOn(embeddings, "embedDocuments");

    const args = { collectionName: "testCollection", index: mockClient };
    const documents = expectedPageContents.map((pc) => ({
      pageContent: pc,
      metadata: { source: "source.html", loc: { lines: { from: 0, to: 4 } } },
    }));

    const chroma = new Chroma(embeddings, args);
    await chroma.addDocuments(documents as any);

    const { metadatas } = mockCollection.upsert.mock.calls[0][0];

    expect(metadatas[0]).toEqual({
      source: "source.html",
      locFrom: 0,
      locTo: 4,
    });
  });

  test("should throw an error for mismatched vector lengths", async () => {
    const args = { collectionName: "testCollection" };
    const vectors = [
      [1, 2],
      [3, 4],
    ];
    const documents = [
      { metadata: { id: 1 }, pageContent: "Document 1" },
      { metadata: { id: 2 }, pageContent: "Document 2" },
    ];

    const chroma = new Chroma(new FakeEmbeddings(), args);
    chroma.numDimensions = 3; // Mismatched numDimensions

    await expect(chroma.addVectors(vectors, documents)).rejects.toThrow();
  });

  test("should perform similarity search and return results", async () => {
    const args = { collectionName: "testCollection" };
    const query = [1, 2];
    const expectedResultCount = 5;
    mockCollection.query = vi.fn<Collection["query"]>().mockResolvedValue({
      ids: [["0", "1", "2", "3", "4"]],
      distances: [[0.1, 0.2, 0.3, 0.4, 0.5]],
      documents: [
        ["Document 1", "Document 2", "Document 3", "Document 4", "Document 5"],
      ],
      metadatas: [[{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]],
    } as any);

    const chroma = new Chroma(new FakeEmbeddings(), args);
    chroma.collection = mockCollection;

    const results = await chroma.similaritySearchVectorWithScore(
      query,
      expectedResultCount
    );

    expect(mockCollection.query).toHaveBeenCalledWith({
      queryEmbeddings: [query],
      nResults: expectedResultCount,
      where: undefined,
    });
    expect(results).toHaveLength(5);
  });

  test("should return id properly when adding documents", async () => {
    const document1 = {
      pageContent: "Document 1",
      metadata: { source: "https://example.com" },
    };

    const documents = [document1];

    const chroma = new Chroma(new FakeEmbeddings(), {
      collectionName: "new-test-collection",
      index: mockClient,
    });

    await chroma.addDocuments(documents, { ids: ["0"] });
    const result = await chroma.similaritySearch(document1.pageContent, 1);

    expect(result[0]).toHaveProperty("id", "0");
  });
});
