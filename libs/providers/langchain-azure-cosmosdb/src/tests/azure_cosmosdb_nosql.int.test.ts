import { test, expect, beforeEach, describe } from "vitest";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import {
  AzureCosmosDBNoSQLVectorStore,
  AzureCosmosDBNoSQLConfig,
  AzureCosmosDBNoSQLSearchType,
  type VectorIndex,
} from "../azure_cosmosdb_nosql.js";

const DATABASE_NAME = "langchainTestDB";
const CONTAINER_NAME = "testContainer";

/*
 * To run this test, you need have an Azure Cosmos DB for NoSQL instance
 * running. You can deploy a free version on Azure Portal without any cost,
 * following this guide:
 * https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search
 *
 * You do not need to create a database or collection, it will be created
 * automatically by the test.
 *
 * Once you have the instance running, you need to set the following environment
 * variables before running the test:
 * - AZURE_COSMOSDB_NOSQL_CONNECTION_STRING or AZURE_COSMOSDB_NOSQL_ENDPOINT
 * - AZURE_OPENAI_API_KEY
 * - AZURE_OPENAI_API_INSTANCE_NAME
 * - AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME
 * - AZURE_OPENAI_API_VERSION
 *
 * A regular OpenAI key can also be used instead of Azure OpenAI.
 *
 * Note: Full-text and hybrid search tests require Azure Cosmos DB with
 * full-text search support enabled (preview feature).
 */

const testDocuments = [
  { pageContent: "This book is about politics", metadata: { a: 1 } },
  { pageContent: "Cats sleeps a lot.", metadata: { b: 1 } },
  { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
  { pageContent: "The house is open", metadata: { d: 1, e: 2 } },
];

/** Base configuration for a vector-only store. */
const baseConfig: AzureCosmosDBNoSQLConfig = {
  databaseName: DATABASE_NAME,
  containerName: CONTAINER_NAME,
};

/**
 * Configuration for a store with full-text search enabled.
 * Required for full-text and hybrid search tests.
 */
const fullTextConfig: AzureCosmosDBNoSQLConfig = {
  databaseName: DATABASE_NAME,
  containerName: CONTAINER_NAME,
  fullTextSearchEnabled: true,
  fullTextPolicy: {
    defaultLanguage: "en-US",
    fullTextPaths: [{ path: "/text", language: "en-US" }],
  },
  indexingPolicy: {
    indexingMode: "consistent",
    automatic: true,
    includedPaths: [{ path: "/*" }],
    excludedPaths: [{ path: "/_etag/?" }],
    vectorIndexes: [{ path: "/vector", type: "quantizedFlat" } as VectorIndex],
    fullTextIndexes: [{ path: "/text" }],
  },
};

describe("AzureCosmosDBNoSQLVectorStore", () => {
  beforeEach(async () => {
    // Note: when using Azure OpenAI, you have to also set these variables
    // in addition to the API key:
    // - AZURE_OPENAI_API_INSTANCE_NAME
    // - AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME
    // - AZURE_OPENAI_API_VERSION
    expect(
      process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY
    ).toBeDefined();

    let client: CosmosClient;

    if (process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING) {
      client = new CosmosClient(
        process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING
      );
    } else if (process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT) {
      client = new CosmosClient({
        endpoint: process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT,
        aadCredentials: new DefaultAzureCredential(),
      });
    } else {
      throw new Error(
        "Please set the environment variable AZURE_COSMOSDB_NOSQL_CONNECTION_STRING or AZURE_COSMOSDB_NOSQL_ENDPOINT"
      );
    }

    // Make sure the database does not exist
    try {
      await client.database(DATABASE_NAME).delete();
    } catch {
      // Ignore error if the database does not exist
    }
  });

  // ---------------------------------------------------------------------------
  // Vector search
  // ---------------------------------------------------------------------------

  describe("vector search", () => {
    test("performs similarity search", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );

      expect(vectorStore).toBeDefined();

      await vectorStore.addDocuments(testDocuments);

      const results = await vectorStore.similaritySearch("sandwich", 1);

      expect(results.length).toEqual(1);
      expect(results).toMatchObject([
        { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
      ]);
    });

    test("performs similarity search with score", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );

      await vectorStore.addDocuments(testDocuments);

      const results = await vectorStore.similaritySearchWithScore(
        "sandwich",
        1
      );

      expect(results.length).toEqual(1);
      expect(results[0][0].pageContent).toBe("Sandwiches taste good.");
      expect(results[0][1]).toBeGreaterThan(0);
    });

    test("performs similarity search with filter clause", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );

      await vectorStore.addDocuments(testDocuments);

      const results = await vectorStore.similaritySearch("sandwich", 1, {
        filterClause: "WHERE c.metadata.d = 1",
      });

      expect(results.length).toEqual(1);
      expect(results).toMatchObject([
        { pageContent: "The house is open", metadata: { d: 1, e: 2 } },
      ]);
    });

    test("performs similarity search with parameterized filter clause", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );

      await vectorStore.addDocuments(testDocuments);

      const results = await vectorStore.similaritySearch("sandwich", 1, {
        filterClause: {
          query: "WHERE c.metadata.d = @filterValue",
          parameters: [{ name: "@filterValue", value: 1 }],
        },
      });

      expect(results.length).toEqual(1);
      expect(results).toMatchObject([
        { pageContent: "The house is open", metadata: { d: 1, e: 2 } },
      ]);
    });

    test("performs similarity search including vectors in results", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );

      await vectorStore.addDocuments(testDocuments);

      const results: Document[] = await vectorStore.similaritySearch(
        "sandwich",
        1,
        { includeEmbeddings: true }
      );

      expect(results.length).toEqual(1);
      expect(results).toMatchObject([
        { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
      ]);
      expect(results[0].metadata.vector).toBeDefined();
    });

    test("works with the retriever interface", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );

      await vectorStore.addDocuments(testDocuments);

      const retriever = vectorStore.asRetriever({});

      const docs = await retriever.invoke("house");
      expect(docs).toBeDefined();
      expect(docs[0]).toMatchObject({
        pageContent: "The house is open",
        metadata: { d: 1, e: 2 },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Vector search with score threshold
  // ---------------------------------------------------------------------------

  describe("vector search with score threshold", () => {
    test("returns results above threshold", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );

      await vectorStore.addDocuments(testDocuments);

      const results = await vectorStore.similaritySearchWithScore(
        "sandwich",
        10,
        {
          searchType: AzureCosmosDBNoSQLSearchType.VectorScoreThreshold,
          threshold: 0.1,
        }
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0][0].pageContent).toBe("Sandwiches taste good.");
      for (const [, score] of results) {
        expect(score).toBeGreaterThanOrEqual(0.1);
      }
    });

    test("filters out results below threshold", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );

      await vectorStore.addDocuments(testDocuments);

      // Use a very high threshold to filter out most results
      const results = await vectorStore.similaritySearchWithScore(
        "sandwich",
        10,
        {
          searchType: AzureCosmosDBNoSQLSearchType.VectorScoreThreshold,
          threshold: 0.99,
        }
      );

      // Should return fewer results than total documents
      expect(results.length).toBeLessThan(testDocuments.length);
    });
  });

  // ---------------------------------------------------------------------------
  // Full-text search (preview feature)
  // ---------------------------------------------------------------------------

  describe("full-text search", () => {
    test("performs full-text search using FullTextContains", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        fullTextConfig
      );

      await vectorStore.addDocuments(testDocuments);

      const results = await vectorStore.similaritySearch("", 10, {
        searchType: AzureCosmosDBNoSQLSearchType.FullTextSearch,
        filterClause: "WHERE FullTextContains(c.text, 'sandwich')",
      });

      expect(results.length).toBeGreaterThan(0);
      // FullTextContains should match documents containing "sandwich"
      const pageContents = results.map((doc) => doc.pageContent.toLowerCase());
      expect(pageContents.some((c) => c.includes("sandwich"))).toBe(true);
    });

    test("performs full-text ranking search", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        fullTextConfig
      );

      await vectorStore.addDocuments(testDocuments);

      const results = await vectorStore.similaritySearch("", 10, {
        searchType: AzureCosmosDBNoSQLSearchType.FullTextRanking,
        fullTextRankFilter: [
          { searchField: "text", searchText: "sandwich taste" },
        ],
      });

      expect(results.length).toBeGreaterThan(0);
      // Most relevant result should be ranked first
      expect(results[0].pageContent).toBe("Sandwiches taste good.");
    });

    test("full-text ranking requires fullTextRankFilter", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        fullTextConfig
      );

      await vectorStore.addDocuments(testDocuments);

      await expect(
        vectorStore.similaritySearch("query", 10, {
          searchType: AzureCosmosDBNoSQLSearchType.FullTextRanking,
        })
      ).rejects.toThrow(/fullTextRankFilter is required/);
    });
  });

  // ---------------------------------------------------------------------------
  // Hybrid search (preview feature)
  // ---------------------------------------------------------------------------

  describe("hybrid search", () => {
    test("performs hybrid search combining vector and full-text", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        fullTextConfig
      );

      await vectorStore.addDocuments(testDocuments);

      const results = await vectorStore.similaritySearchWithScore(
        "sandwich",
        10,
        {
          searchType: AzureCosmosDBNoSQLSearchType.Hybrid,
          fullTextRankFilter: [{ searchField: "text", searchText: "sandwich" }],
        }
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0][0].pageContent).toBe("Sandwiches taste good.");
      // Hybrid search should return a similarity score
      expect(results[0][1]).toBeGreaterThan(0);
    });

    test("performs hybrid search with score threshold", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        fullTextConfig
      );

      await vectorStore.addDocuments(testDocuments);

      const results = await vectorStore.similaritySearchWithScore(
        "sandwich",
        10,
        {
          searchType: AzureCosmosDBNoSQLSearchType.HybridScoreThreshold,
          fullTextRankFilter: [{ searchField: "text", searchText: "sandwich" }],
          threshold: 0.1,
        }
      );

      expect(results.length).toBeGreaterThan(0);
      for (const [, score] of results) {
        expect(score).toBeGreaterThanOrEqual(0.1);
      }
    });

    test("hybrid search requires fullTextRankFilter", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        fullTextConfig
      );

      await vectorStore.addDocuments(testDocuments);

      await expect(
        vectorStore.similaritySearch("query", 10, {
          searchType: AzureCosmosDBNoSQLSearchType.Hybrid,
        })
      ).rejects.toThrow(/fullTextRankFilter is required/);
    });

    test("hybrid score threshold search requires fullTextRankFilter", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        fullTextConfig
      );

      await vectorStore.addDocuments(testDocuments);

      await expect(
        vectorStore.similaritySearch("query", 10, {
          searchType: AzureCosmosDBNoSQLSearchType.HybridScoreThreshold,
        })
      ).rejects.toThrow(/fullTextRankFilter is required/);
    });
  });

  // ---------------------------------------------------------------------------
  // Max marginal relevance search
  // ---------------------------------------------------------------------------

  describe("max marginal relevance search", () => {
    test("performs MMR search with text query", async () => {
      const texts = ["foo", "foo", "fox"];
      const vectorStore = await AzureCosmosDBNoSQLVectorStore.fromTexts(
        texts,
        {},
        new OpenAIEmbeddings(),
        baseConfig
      );

      const output = await vectorStore.maxMarginalRelevanceSearch("foo", {
        k: 10,
        fetchK: 20,
        lambda: 0.1,
      });

      expect(output).toHaveLength(texts.length);

      // MMR should promote diversity: "fox" should appear before the second "foo"
      const actual = output.map((doc) => doc.pageContent);
      const expected = ["foo", "fox", "foo"];
      expect(actual).toEqual(expected);
    });

    test("performs MMR search with vector query", async () => {
      const embeddings = new OpenAIEmbeddings();
      const texts = ["foo", "foo", "fox"];
      const vectorStore = await AzureCosmosDBNoSQLVectorStore.fromTexts(
        texts,
        {},
        embeddings,
        baseConfig
      );

      const queryEmbedding = await embeddings.embedQuery("foo");
      const docs = await vectorStore.maxMarginalRelevanceSearchByVector(
        queryEmbedding,
        {
          k: 3,
          fetchK: 20,
          lambda: 0.1,
        }
      );

      expect(docs.length).toBe(3);
      // MMR should promote diversity
      const pageContents = docs.map((doc) => doc.pageContent);
      expect(pageContents).toContain("fox");
    });
  });

  // ---------------------------------------------------------------------------
  // Default search type configuration
  // ---------------------------------------------------------------------------

  describe("default search type", () => {
    test("uses vector search by default", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );

      await vectorStore.addDocuments(testDocuments);

      // No searchType in filter — should use default (vector)
      const results = await vectorStore.similaritySearchWithScore(
        "sandwich",
        1
      );

      expect(results.length).toEqual(1);
      expect(results[0][0].pageContent).toBe("Sandwiches taste good.");
      expect(results[0][1]).toBeGreaterThan(0);
    });

    test("uses configured defaultSearchType", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        {
          ...baseConfig,
          defaultSearchType: AzureCosmosDBNoSQLSearchType.VectorScoreThreshold,
        }
      );

      await vectorStore.addDocuments(testDocuments);

      // No searchType in filter — should use vector_score_threshold as default
      // With default threshold of 0.5, some low-scoring results should be filtered out
      const results = await vectorStore.similaritySearchWithScore(
        "sandwich",
        10,
        { threshold: 0.1 }
      );

      expect(results.length).toBeGreaterThan(0);
      for (const [, score] of results) {
        expect(score).toBeGreaterThanOrEqual(0.1);
      }
    });

    test("filter searchType overrides defaultSearchType", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        {
          ...baseConfig,
          // Default is vector_score_threshold
          defaultSearchType: AzureCosmosDBNoSQLSearchType.VectorScoreThreshold,
        }
      );

      await vectorStore.addDocuments(testDocuments);

      // Override with plain vector search in filter
      const results = await vectorStore.similaritySearchWithScore(
        "sandwich",
        10,
        { searchType: AzureCosmosDBNoSQLSearchType.Vector }
      );

      // Plain vector search returns all results regardless of score
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Document management
  // ---------------------------------------------------------------------------

  describe("document management", () => {
    test("deletes documents by id", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );

      const ids = await vectorStore.addDocuments([
        { pageContent: "This book is about politics", metadata: { a: 1 } },
        {
          pageContent: "The is the house of parliament",
          metadata: { d: 1, e: 2 },
        },
      ]);

      // Delete document matching specified ids
      await vectorStore.delete({ ids: ids.slice(0, 1) });

      const results = await vectorStore.similaritySearch("politics", 10);

      expect(results.length).toEqual(1);
      expect(results[0].pageContent).toEqual("The is the house of parliament");
    });

    test("deletes documents by filter", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );

      await vectorStore.addDocuments([
        { pageContent: "This book is about politics", metadata: { a: 1 } },
        {
          pageContent: "The is the house of parliament",
          metadata: { d: 1, e: 2 },
        },
      ]);

      // Delete document matching the filter
      await vectorStore.delete({
        filter: {
          query: "SELECT * FROM c WHERE c.metadata.a = @value",
          parameters: [{ name: "@value", value: 1 }],
        },
      });

      const results = await vectorStore.similaritySearch("politics", 10);

      expect(results.length).toEqual(1);
      expect(results[0].pageContent).toEqual("The is the house of parliament");
    });

    test("deletes all documents", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );

      const documents = Array.from({ length: 101 }, (_, i) => ({
        pageContent: `Document ${i}`,
        metadata: { a: i },
      }));

      await vectorStore.addDocuments(documents);

      // Delete all documents
      await vectorStore.delete();

      // Verify deletion by querying the container directly
      // (vector search may hang on empty containers)
      const container = vectorStore.getContainer();
      const { resources } = await container.items
        .query("SELECT c.id FROM c")
        .fetchAll();

      expect(resources.length).toEqual(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Configuration and utilities
  // ---------------------------------------------------------------------------

  describe("configuration", () => {
    test("getContainer returns the underlying container", async () => {
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );

      await vectorStore.addDocuments([
        { pageContent: "Test document", metadata: {} },
      ]);

      const container = vectorStore.getContainer();
      expect(container).toBeDefined();
      expect(container.id).toBe(CONTAINER_NAME);
    });

    test("connect using managed identity", async () => {
      // Skip if endpoint is not defined (needed for managed identity)
      if (!process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT) {
        console.log(
          "Skipping managed identity test: AZURE_COSMOSDB_NOSQL_ENDPOINT not set"
        );
        return;
      }

      // First initialize using a regular connection string
      // to create the database and container, as managed identity
      // with RBAC does not have permission to create them.
      const vectorStoreCS = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );
      await vectorStoreCS.addDocuments([{ pageContent: "init", metadata: {} }]);

      const connectionString =
        process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING;
      if (connectionString) {
        // Remove the connection string to test managed identity
        process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING = "";
      }

      expect(process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING).toBeFalsy();
      expect(process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT).toBeDefined();

      const vectorStore = new AzureCosmosDBNoSQLVectorStore(
        new OpenAIEmbeddings(),
        baseConfig
      );

      expect(vectorStore).toBeDefined();

      await vectorStore.addDocuments(testDocuments);

      const results = await vectorStore.similaritySearch("sandwich", 1);

      expect(results.length).toEqual(1);
      expect(results).toMatchObject([
        { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
      ]);

      if (connectionString) {
        // Restore the connection string
        process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING = connectionString;
      }
    });
  });
});
