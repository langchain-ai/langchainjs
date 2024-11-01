/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";
import { FakeEmbeddings, FakeLLM } from "@langchain/core/utils/testing";
import { AzureCosmosDBNoSQLSemanticCache } from "../index.js";

// Create the mock Cosmos DB client
const createMockClient = () => {
  let id = 0;
  const client = {
    databases: {
      createIfNotExists: jest.fn().mockReturnThis(),
      get database() {
        return this;
      },
      containers: {
        createIfNotExists: jest.fn().mockReturnThis(),
        get container() {
          return this;
        },
        items: {
          create: jest.fn().mockImplementation((doc: any) => ({
            // eslint-disable-next-line no-plusplus
            resource: { id: doc.id ?? `${id++}` },
          })),
          query: jest.fn().mockReturnThis(),
          fetchAll: jest.fn().mockImplementation(() => ({
            resources: [
              {
                metadata: {
                  return_value: ['{"text": "fizz"}'], // Simulate stored serialized generation
                },
                similarityScore: 0.8,
              },
            ],
          })),
        },
        item: jest.fn().mockReturnThis(),
        delete: jest.fn(),
      },
    },
  };
  return client;
};

describe("AzureCosmosDBNoSQLSemanticCache", () => {
  it("should store, retrieve, and clear cache", async () => {
    const client = createMockClient();
    const embeddings = new FakeEmbeddings();
    const cache = new AzureCosmosDBNoSQLSemanticCache(embeddings, {
      client: client as any,
    });
    expect(cache).toBeDefined();

    const llm = new FakeLLM({});
    const llmString = JSON.stringify(llm._identifyingParams());

    await cache.update("foo", llmString, [{ text: "fizz" }]);
    expect(client.databases.containers.items.create).toHaveBeenCalled();

    const result = await cache.lookup("foo", llmString);
    expect(result).toEqual([{ text: "fizz" }]);
    expect(client.databases.containers.items.query).toHaveBeenCalled();

    await cache.clear(llmString);
    expect(client.databases.containers.delete).toHaveBeenCalled();
  });
});
