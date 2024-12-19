/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line import/no-extraneous-dependencies
import { jest } from "@jest/globals";
import { FakeEmbeddings, FakeLLM } from "@langchain/core/utils/testing";
import { Document } from "@langchain/core/documents";
import { MongoClient } from "mongodb";
import { AzureCosmosDBMongoDBSemanticCache } from "../../index.js";

const createMockClient = () => ({
  db: jest.fn<any>().mockReturnValue({
    collectionName: "documents",
    collection: jest.fn<any>().mockReturnValue({
      listIndexes: jest.fn().mockReturnValue({
        toArray: jest.fn().mockReturnValue([
          {
            name: "vectorSearchIndex",
          },
        ]),
      }),
      findOne: jest.fn().mockReturnValue({
        metadata: {
          return_value: ['{"text": "fizz"}'],
        },
        similarityScore: 0.8,
      }),
      insertMany: jest.fn().mockImplementation((docs: any) => ({
        insertedIds: docs.map((_: any, i: any) => `id${i}`),
      })),
      aggregate: jest.fn().mockReturnValue({
        map: jest.fn().mockReturnValue({
          toArray: jest.fn().mockReturnValue([
            [
              new Document({
                pageContent: "test",
                metadata: { return_value: ['{"text": "fizz"}'] },
              }),
              0.8,
            ],
          ]),
        }),
      }),
    }),
    command: jest.fn(),
  }),
  connect: jest.fn(),
  close: jest.fn(),
});

describe("AzureCosmosDBMongoDBSemanticCache", () => {
  it("should store, retrieve, and clear cache in MongoDB", async () => {
    const mockClient = createMockClient() as any;
    const embeddings = new FakeEmbeddings();
    const cache = new AzureCosmosDBMongoDBSemanticCache(
      embeddings,
      {
        client: mockClient as MongoClient,
      },
      0.8
    );

    expect(cache).toBeDefined();

    const llm = new FakeLLM({});
    const llmString = JSON.stringify(llm._identifyingParams());

    await cache.update("foo", llmString, [{ text: "fizz" }]);
    expect(mockClient.db().collection().insertMany).toHaveBeenCalled();

    const result = await cache.lookup("foo", llmString);
    expect(result).toEqual([{ text: "fizz" }]);
  });
});
