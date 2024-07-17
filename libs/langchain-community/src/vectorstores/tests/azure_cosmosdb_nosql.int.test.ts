/* eslint-disable no-process-env */

import { test, expect } from "@jest/globals";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { CosmosClient } from "@azure/cosmos";

import { AzureCosmosDBNoSQLVectorStore } from "../azure_cosmosdb_nosql.js";

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
 * - AZURE_COSMOSDB_NOSQL_CONNECTION_STRING
 * - AZURE_OPENAI_API_KEY
 * - AZURE_OPENAI_API_INSTANCE_NAME
 * - AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME
 * - AZURE_OPENAI_API_VERSION
 *
 * A regular OpenAI key can also be used instead of Azure OpenAI.
 */
describe.skip("AzureCosmosDBNoSQLVectorStore", () => {
  beforeEach(async () => {
    expect(process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING).toBeDefined();

    // Note: when using Azure OpenAI, you have to also set these variables
    // in addition to the API key:
    // - AZURE_OPENAI_API_INSTANCE_NAME
    // - AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME
    // - AZURE_OPENAI_API_VERSION
    expect(
      process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY
    ).toBeDefined();

    const client = new CosmosClient(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING!
    );

    // Make sure the database does not exists
    try {
      await client.database(DATABASE_NAME).delete();
    } catch {
      // Ignore error if the database does not exist
    }
  });

  test("performs similarity search", async () => {
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(new OpenAIEmbeddings(), {
      databaseName: DATABASE_NAME,
      containerName: CONTAINER_NAME,
    });

    expect(vectorStore).toBeDefined();

    await vectorStore.addDocuments([
      { pageContent: "This book is about politics", metadata: { a: 1 } },
      { pageContent: "Cats sleeps a lot.", metadata: { b: 1 } },
      { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
      { pageContent: "The house is open", metadata: { d: 1, e: 2 } },
    ]);

    const results = await vectorStore.similaritySearch(
      "sandwich",
      1
    );

    expect(results.length).toEqual(1);
    expect(results).toMatchObject([
      { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
    ]);

    const retriever = vectorStore.asRetriever({});

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

    const standardRetrieverOutput =
      await standardRetriever.invoke("foo");
    expect(output).toHaveLength(texts.length);

    const standardRetrieverActual = standardRetrieverOutput.map(
      (doc) => doc.pageContent
    );
    const standardRetrieverExpected = ["foo", "foo", "fox"];
    expect(standardRetrieverActual).toEqual(standardRetrieverExpected);

    const retriever = await vectorStore.asRetriever({
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
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(new OpenAIEmbeddings(), {
      databaseName: DATABASE_NAME,
      containerName: CONTAINER_NAME,
    });

    expect(vectorStore).toBeDefined();

    await vectorStore.addDocuments([
      { pageContent: "This book is about politics", metadata: { a: 1 } },
      { pageContent: "Cats sleeps a lot.", metadata: { b: 1 } },
      { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
      { pageContent: "The house is open", metadata: { d: 1, e: 2 } },
    ]);

    const results = await vectorStore.similaritySearch(
      "sandwich",
      1,
      { filterWhereClause: "c.metadata.d = 1" }
    );

    expect(results.length).toEqual(1);
    expect(results).toMatchObject([
      { pageContent: "The house is open", metadata: { d: 1, e: 2 } },
    ]);
  });

  test("performs similarity search including vectors in the results", async () => {
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(new OpenAIEmbeddings(), {
      databaseName: DATABASE_NAME,
      containerName: CONTAINER_NAME,
    });

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
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(new OpenAIEmbeddings(), {
      databaseName: DATABASE_NAME,
      containerName: CONTAINER_NAME,
    });

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
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(new OpenAIEmbeddings(), {
      databaseName: DATABASE_NAME,
      containerName: CONTAINER_NAME,
    });

    await vectorStore.addDocuments([
      { pageContent: "This book is about politics", metadata: { a: 1 } },
      {
        pageContent: "The is the house of parliament",
        metadata: { d: 1, e: 2 },
      },
    ]);

    // Delete document matching the filter
    await vectorStore.delete({ filter: {
      query: "SELECT * FROM c WHERE c.metadata.a = @value",
      parameters: [{ name: "@value", value: 1 }],
    } });

    const results = await vectorStore.similaritySearch("politics", 10);

    expect(results.length).toEqual(1);
    expect(results[0].pageContent).toEqual("The is the house of parliament");
  });

  test("deletes all documents", async () => {
    const vectorStore = new AzureCosmosDBNoSQLVectorStore(new OpenAIEmbeddings(), {
      databaseName: DATABASE_NAME,
      containerName: CONTAINER_NAME,
    });

    const documents = Array.from({ length: 101 }, (_, i) => ({
      pageContent: `Document ${i}`,
      metadata: { a: i },
    }));

    await vectorStore.addDocuments(documents);

    // Delete all documents
    await vectorStore.delete();

    const results = await vectorStore.similaritySearch("document", 10);

    expect(results.length).toEqual(0);
  });
});
