import { test, expect, beforeEach, describe } from "vitest";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { CosmosClient } from "@azure/cosmos";

import { DefaultAzureCredential } from "@azure/identity";
import {
  AzureCosmosDBNoSQLVectorStore,
  AzureCosmosDBNoSQLVectorStoreRetriever,
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
 */
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

    // Make sure the database does not exists
    try {
      await client.database(DATABASE_NAME).delete();
    } catch {
      // Ignore error if the database does not exist
    }
  });

  test("performs similarity search", async () => {
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
    );

    expect(vectorStore).toBeDefined();

    await vectorStore.addDocuments([
      { pageContent: "This book is about politics", metadata: { a: 1 } },
      { pageContent: "Cats sleeps a lot.", metadata: { b: 1 } },
      { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
      { pageContent: "The house is open", metadata: { d: 1, e: 2 } },
    ]);

    const results = await vectorStore.similaritySearch("sandwich", 1);

    expect(results.length).toEqual(1);
    expect(results).toMatchObject([
      { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
    ]);

    const retriever = vectorStore.asCosmosRetriever({});

    const docs = await retriever.invoke("house");
    expect(docs).toBeDefined();
    expect(docs[0]).toMatchObject({
      pageContent: "The house is open",
      metadata: { d: 1, e: 2 },
    });
  });

  test("performs max marginal relevance search", async () => {
    const texts = ["foo", "foo", "fox"];
    const vectorStore = await AzureCosmosDBNoSQLVectorStore.fromTexts(
      texts,
      {},
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
    );

    const output = await vectorStore.maxMarginalRelevanceSearch("foo", {
      k: 10,
      fetchK: 20,
      lambda: 0.1,
    });

    expect(output).toHaveLength(texts.length);

    const actual = output.map((doc) => doc.pageContent);
    const expected = ["foo", "fox", "foo"];
    expect(actual).toEqual(expected);

    const standardRetriever = await vectorStore.asRetriever();

    const standardRetrieverOutput = await standardRetriever.invoke("foo");
    expect(output).toHaveLength(texts.length);

    const standardRetrieverActual = standardRetrieverOutput.map(
      (doc) => doc.pageContent
    );
    const standardRetrieverExpected = ["foo", "foo", "fox"];
    expect(standardRetrieverActual).toEqual(standardRetrieverExpected);

    const retriever = await vectorStore.asCosmosRetriever({
      searchType: "mmr",
      searchKwargs: {
        fetchK: 20,
        lambda: 0.1,
      },
    });

    const retrieverOutput = await retriever.invoke("foo");
    expect(output).toHaveLength(texts.length);

    const retrieverActual = retrieverOutput.map((doc) => doc.pageContent);
    const retrieverExpected = ["foo", "fox", "foo"];
    expect(retrieverActual).toEqual(retrieverExpected);

    const similarity = await vectorStore.similaritySearchWithScore("foo", 1);
    expect(similarity.length).toBe(1);
  });

  test("performs similarity search with filter", async () => {
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
    );

    expect(vectorStore).toBeDefined();

    await vectorStore.addDocuments([
      { pageContent: "This book is about politics", metadata: { a: 1 } },
      { pageContent: "Cats sleeps a lot.", metadata: { b: 1 } },
      { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
      { pageContent: "The house is open", metadata: { d: 1, e: 2 } },
    ]);

    const results = await vectorStore.similaritySearch("sandwich", 1, {
      filterClause: "WHERE c.metadata.d = 1",
    });

    expect(results.length).toEqual(1);
    expect(results).toMatchObject([
      { pageContent: "The house is open", metadata: { d: 1, e: 2 } },
    ]);
  });

  test("performs similarity search including vectors in the results", async () => {
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
    );

    expect(vectorStore).toBeDefined();

    await vectorStore.addDocuments([
      { pageContent: "This book is about politics", metadata: { a: 1 } },
      { pageContent: "Cats sleeps a lot.", metadata: { b: 1 } },
      { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
      { pageContent: "The house is open", metadata: { d: 1, e: 2 } },
    ]);

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

  test("deletes documents by id", async () => {
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
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
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
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
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
    );

    const documents = Array.from({ length: 10 }, (_, i) => ({
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

  test("connect using managed identity", async () => {
    // Skip if endpoint is not defined (needed for managed identity)
    if (!process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT) {
      console.log(
        "Skipping managed identity test: AZURE_COSMOSDB_NOSQL_ENDPOINT not set"
      );
      return;
    } else {
      console.log(
        "Running managed identity test: AZURE_COSMOSDB_NOSQL_ENDPOINT is set"
      );
    }

    // First initialize using a regular connection string
    // to create the database and container, as managed identity
    // with RBAC does not have permission to create them.
    const vectorStoreCS = new AzureCosmosDBNoSQLVectorStore(
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
    );
    await vectorStoreCS.addDocuments([{ pageContent: "init", metadata: {} }]);

    const connectionString = process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING;
    if (connectionString) {
      // Remove the connection string to test managed identity
      process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING = "";
    }

    expect(process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING).toBeFalsy();
    expect(process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT).toBeDefined();

    const vectorStore = new AzureCosmosDBNoSQLVectorStore(
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
    );

    expect(vectorStore).toBeDefined();

    await vectorStore.addDocuments([
      { pageContent: "This book is about politics", metadata: { a: 1 } },
      { pageContent: "Cats sleeps a lot.", metadata: { b: 1 } },
      { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
      { pageContent: "The house is open", metadata: { d: 1, e: 2 } },
    ]);

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

  test("performs vector search with score threshold", async () => {
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
    );

    await vectorStore.addDocuments([
      { pageContent: "This book is about politics", metadata: { a: 1 } },
      { pageContent: "Cats sleeps a lot.", metadata: { b: 1 } },
      { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
      { pageContent: "The house is open", metadata: { d: 1, e: 2 } },
    ]);

    // Search with a high threshold (should filter out low-scoring results)
    const results = await vectorStore.vectorSearchWithThreshold(
      "sandwich",
      10,
      0.1 // Low threshold to include results
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0][0].pageContent).toBe("Sandwiches taste good.");
    expect(results[0][1]).toBeGreaterThanOrEqual(0.1);
  });

  test("uses custom cosmos retriever with vector search", async () => {
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
    );

    await vectorStore.addDocuments([
      { pageContent: "This book is about politics", metadata: { a: 1 } },
      { pageContent: "Cats sleeps a lot.", metadata: { b: 1 } },
      { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
      { pageContent: "The house is open", metadata: { d: 1, e: 2 } },
    ]);

    const retriever = vectorStore.asCosmosRetriever({
      searchType: "vector",
      k: 2,
    });

    expect(retriever).toBeInstanceOf(AzureCosmosDBNoSQLVectorStoreRetriever);

    const docs = await retriever.invoke("sandwich");
    expect(docs.length).toBeLessThanOrEqual(2);
    expect(docs[0].pageContent).toBe("Sandwiches taste good.");
  });

  test("uses custom cosmos retriever with vector_score_threshold", async () => {
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
    );

    await vectorStore.addDocuments([
      { pageContent: "This book is about politics", metadata: { a: 1 } },
      { pageContent: "Cats sleeps a lot.", metadata: { b: 1 } },
      { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
      { pageContent: "The house is open", metadata: { d: 1, e: 2 } },
    ]);

    const retriever = vectorStore.asCosmosRetriever({
      searchType: "vector_score_threshold",
      k: 10,
      searchKwargs: {
        scoreThreshold: 0.1,
      },
    });

    const docs = await retriever.invoke("sandwich");
    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0].pageContent).toBe("Sandwiches taste good.");
  });

  test("uses custom cosmos retriever with mmr search", async () => {
    const texts = ["foo", "foo", "fox"];
    const vectorStore = await AzureCosmosDBNoSQLVectorStore.fromTexts(
      texts,
      {},
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
    );

    const retriever = vectorStore.asCosmosRetriever({
      searchType: "mmr",
      k: 3,
      searchKwargs: {
        fetchK: 20,
        lambda: 0.1,
      },
    });

    const docs = await retriever.invoke("foo");
    expect(docs.length).toBe(3);

    // MMR should promote diversity
    const pageContents = docs.map((doc) => doc.pageContent);
    expect(pageContents).toContain("fox");
  });

  test("getContainer returns the underlying container", async () => {
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
    );

    await vectorStore.addDocuments([
      { pageContent: "Test document", metadata: {} },
    ]);

    const container = vectorStore.getContainer();
    expect(container).toBeDefined();
    expect(container.id).toBe(CONTAINER_NAME);
  });

  test("deleteDocumentById removes a specific document", async () => {
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
    );

    const ids = await vectorStore.addDocuments([
      { pageContent: "Document to keep", metadata: {} },
      { pageContent: "Document to delete", metadata: {} },
    ]);

    await vectorStore.deleteDocumentById(ids[1]);

    const results = await vectorStore.similaritySearch("delete", 10);
    expect(results.every((r) => r.pageContent !== "Document to delete")).toBe(
      true
    );
  });

  test("maxMarginalRelevanceSearchByVector works with embeddings", async () => {
    const embeddings = new OpenAIEmbeddings();
    const texts = ["foo", "foo", "fox"];
    const vectorStore = await AzureCosmosDBNoSQLVectorStore.fromTexts(
      texts,
      {},
      embeddings,
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
      }
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
