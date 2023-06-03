/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";

import { type Collection } from "chromadb";
import { Chroma } from "../chroma.js";
import { FakeEmbeddings } from "../../embeddings/fake.js";

const mockCollection = {
  add: jest.fn<Collection["add"]>().mockResolvedValue(undefined as any),
  count: jest.fn<Collection["count"]>().mockResolvedValue(5),
  // not used, so leave out for now.
  // upsert: jest.fn<Collection["upsert"]>().mockResolvedValue(undefined as any),
  // modify: jest.fn<Collection["modify"]>().mockResolvedValue(undefined as any),
  // get: jest.fn<Collection["get"]>().mockResolvedValue(undefined as any),
  // update: jest.fn<Collection["update"]>().mockResolvedValue({ success: true }),
  // query: jest.fn<Collection["query"]>().mockResolvedValue(undefined as any),
  // peek: jest.fn<Collection["peek"]>().mockResolvedValue(undefined as any),
  // delete: jest.fn<Collection["delete"]>().mockResolvedValue(undefined as any),
} as any;

const mockClient = {
  getOrCreateCollection: jest.fn<any>().mockResolvedValue(mockCollection),
} as any;

describe("Chroma", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    jest.spyOn(embeddings, "embedDocuments");
    const args = { collectionName: "testCollection", index: mockClient };
    const documents = expectedPageContents.map((pc) => ({ pageContent: pc }));

    const chroma = new Chroma(embeddings, args);
    await chroma.addDocuments(documents as any);

    expect(mockClient.getOrCreateCollection).toHaveBeenCalled();
    expect(embeddings.embedDocuments).toHaveBeenCalledWith(
      expectedPageContents
    );
    expect(mockCollection.add).toHaveBeenCalled();
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

    await expect(chroma.addVectors(vectors, documents)).rejects.toThrowError();
  });

  test("should perform similarity search and return results", async () => {
    const args = { collectionName: "testCollection" };
    const query = [1, 2];
    const expectedResultCount = 5;
    mockCollection.query = jest.fn<Collection["query"]>().mockResolvedValue({
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
      queryEmbeddings: query,
      nResults: expectedResultCount,
      where: {},
    });
    expect(results).toHaveLength(5);
  });
});
