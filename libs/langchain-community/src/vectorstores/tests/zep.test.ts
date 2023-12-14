/* eslint-disable @typescript-eslint/no-explicit-any, no-new, @typescript-eslint/no-misused-promises */

import { expect, jest, test } from "@jest/globals";

import {
  DocumentCollection,
  IDocument,
  NotFoundError,
  ZepClient,
} from "@getzep/zep-js";
import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { IZepConfig, ZepVectorStore } from "../zep.js";
import { FakeEmbeddings } from "../../utils/testing.js";

jest.mock("@getzep/zep-js");

const mockDocuments = [
  {
    pageContent: "foo bar baz",
    metadata: { bar: "baz" },
  },
  {
    pageContent: "foo qux baz",
    metadata: { qux: "bar" },
  },
  {
    pageContent: "foo bar baz",
    metadata: { foo: "bar" },
  },
];

const mockZepDocuments: IDocument[] = mockDocuments.map((doc, index) => ({
  uuid: `uuid${index}`,
  content: doc.pageContent,
  metadata: doc.metadata,
  embeddings: new Float32Array([0.0, 0.1]),
  score: Math.random(),
}));

const mockCollection = {
  addDocuments: jest
    .fn<DocumentCollection["addDocuments"]>()
    .mockResolvedValue(["uuid1", "uuid2", "uuid3"]),
  search: jest
    .fn<DocumentCollection["search"]>()
    .mockResolvedValue(mockZepDocuments as any),
  deleteDocument: jest
    .fn<DocumentCollection["deleteDocument"]>()
    .mockResolvedValue(undefined as any),
  searchReturnQueryVector: jest
    .fn<DocumentCollection["searchReturnQueryVector"]>()
    .mockResolvedValue([mockZepDocuments, new Float32Array([0.0, 0.1])] as any),
  name: "testCollection",
  is_auto_embedded: true,
} as any;

const mockClient = {
  document: {
    getCollection: jest.fn<any>().mockResolvedValue(mockCollection),
    addCollection: jest.fn<any>().mockResolvedValue(mockCollection),
  },
} as any;

function isADocument(obj: any): obj is IDocument {
  return "content" in obj && "metadata" in obj && "embedding" in obj;
}

describe("ZepVectorStore", () => {
  let zepConfig: IZepConfig;
  let embeddings: Embeddings;

  beforeEach(() => {
    zepConfig = {
      apiUrl: "http://api.zep.com",
      apiKey: "123456",
      collectionName: "testCollection",
      description: "Test Description",
      metadata: {},
      embeddingDimensions: 100,
      isAutoEmbedded: true,
    };
    embeddings = new FakeEmbeddings();

    jest
      .spyOn(ZepClient, "init")
      .mockImplementation(() => Promise.resolve(mockClient));
  });

  test("should instantiate class successfully when a Collection exists", async () => {
    new ZepVectorStore(embeddings, zepConfig);

    // Wait for any promises in constructor to resolve
    await new Promise(setImmediate);

    expect(ZepClient.init).toHaveBeenCalledWith(
      zepConfig.apiUrl,
      zepConfig.apiKey
    );
    expect(mockClient.document.getCollection).toHaveBeenCalledWith(
      zepConfig.collectionName
    );
  });

  test("should instantiate class successfully when a Collection does not exist", async () => {
    mockClient.document.getCollection.mockRejectedValueOnce(
      new NotFoundError("Collection not found")
    );

    new ZepVectorStore(embeddings, zepConfig);

    // Wait for any promises in constructor to resolve
    await new Promise(setImmediate);

    expect(ZepClient.init).toHaveBeenCalledWith(
      zepConfig.apiUrl,
      zepConfig.apiKey
    );
    expect(mockClient.document.getCollection).toHaveBeenCalledWith(
      zepConfig.collectionName
    );
    expect(mockClient.document.addCollection).toHaveBeenCalledWith({
      name: zepConfig.collectionName,
      description: zepConfig.description,
      metadata: zepConfig.metadata,
      embeddingDimensions: zepConfig.embeddingDimensions,
      isAutoEmbedded: zepConfig.isAutoEmbedded,
    });
  });

  test("should add documents successfully", async () => {
    const zepVectorStore = new ZepVectorStore(embeddings, zepConfig);

    (zepVectorStore as any).collection = mockCollection;

    const result = await zepVectorStore.addDocuments(mockDocuments);

    expect(mockCollection.addDocuments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: "foo bar baz",
          metadata: { bar: "baz" },
        }),
        expect.objectContaining({
          content: "foo qux baz",
          metadata: { qux: "bar" },
        }),
        expect.objectContaining({
          content: "foo bar baz",
          metadata: { foo: "bar" },
        }),
      ])
    );

    expect(result).toEqual(["uuid1", "uuid2", "uuid3"]);
  });

  test("should delete documents successfully", async () => {
    const zepVectorStore = new ZepVectorStore(embeddings, zepConfig);
    // Inject mockCollection into zepVectorStore
    (zepVectorStore as any).collection = mockCollection;

    const uuidsToDelete = ["uuid1", "uuid2", "uuid3"];

    await zepVectorStore.delete({ uuids: uuidsToDelete });

    uuidsToDelete.forEach((uuid) => {
      expect(mockCollection.deleteDocument).toHaveBeenCalledWith(uuid);
    });
  });

  test("should create ZepVectorStore from texts successfully", async () => {
    const texts = ["text1", "text2", "text3"];
    const metadatas = [{ foo: "bar" }, { baz: "qux" }, { quux: "corge" }];

    // Mock ZepVectorStore.fromDocuments to inject mockCollection
    const originalFromDocuments = ZepVectorStore.fromDocuments;
    ZepVectorStore.fromDocuments = jest.fn(
      async (docs, embeddings, zepConfig) => {
        const zepVectorStore = await originalFromDocuments.call(
          ZepVectorStore,
          docs as Document[],
          embeddings as Embeddings,
          zepConfig as IZepConfig
        );
        (zepVectorStore as any).collection = mockCollection;
        return zepVectorStore;
      }
    );

    const zepVectorStore = await ZepVectorStore.fromTexts(
      texts,
      metadatas,
      embeddings,
      zepConfig
    );

    expect(zepVectorStore).toBeInstanceOf(ZepVectorStore);

    // Did we receive an array of 3 documents?
    expect(mockCollection.addDocuments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.anything(),
        expect.anything(),
        expect.anything(),
      ])
    );

    // Check that each object is a valid IDocument
    mockCollection.addDocuments.mock.calls[0][0].forEach((obj: any) => {
      expect(isADocument(obj)).toBe(true);
    });

    // Restore the original ZepVectorStore.fromDocuments
    ZepVectorStore.fromDocuments = originalFromDocuments;
  });

  test("should perform similarity search with score successfully", async () => {
    const zepVectorStore = new ZepVectorStore(embeddings, zepConfig);
    // Inject mockCollection into zepVectorStore
    (zepVectorStore as any).collection = mockCollection;

    const query = [0.1, 0.2, 0.3, 0.4, 0.5];
    const k = 3;
    const filter = { foo: "bar" };

    const result = await zepVectorStore.similaritySearchVectorWithScore(
      query,
      k,
      filter
    );

    expect(mockCollection.search).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding: new Float32Array(query),
        metadata: filter,
      }),
      k
    );

    const docsAndScores = mockZepDocuments.map((doc) => [
      new Document({
        pageContent: doc.content,
        metadata: doc.metadata,
      }),
      doc.score,
    ]);

    expect(result).toEqual(docsAndScores);
  });

  test("should perform similarity search successfully", async () => {
    const zepVectorStore = new ZepVectorStore(embeddings, zepConfig);
    // Inject mockCollection into zepVectorStore
    (zepVectorStore as any).collection = mockCollection;

    const query = "foo bar";
    const k = 3;
    const filter = { foo: "bar" };

    const result = await zepVectorStore.similaritySearch(query, k, filter);

    expect(mockCollection.search).toHaveBeenCalledWith(
      expect.objectContaining({
        text: query,
        metadata: filter,
      }),
      k
    );

    const docs = mockZepDocuments.map(
      (doc) =>
        new Document({
          pageContent: doc.content,
          metadata: doc.metadata,
        })
    );

    expect(result).toEqual(docs);
  });

  test("should perform max marginal relevance search successfully", async () => {
    const zepVectorStore = new ZepVectorStore(embeddings, zepConfig);
    (zepVectorStore as any).collection = mockCollection;

    const query = "foo bar";
    const options = {
      k: 2,
      fetchK: 3,
      lambda: 0.5,
      filter: { foo: "bar" },
    };

    await zepVectorStore.maxMarginalRelevanceSearch(query, options);

    expect(mockCollection.search).toHaveBeenCalledWith(
      expect.objectContaining({
        text: query,
        metadata: options.filter,
      }),
      options.fetchK
    );
  });
});
