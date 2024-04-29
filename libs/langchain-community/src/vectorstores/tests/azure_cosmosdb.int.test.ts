/* eslint-disable no-process-env */

import { test, expect } from "@jest/globals";
import { MongoClient } from "mongodb";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

import { AzureCosmosDBVectorStore } from "../azure_cosmosdb.js";

const DATABASE_NAME = "langchain";
const COLLECTION_NAME = "test";
const INDEX_NAME = "vectorSearchIndex";

/*
 * To run this test, you need have an Azure Cosmos DB for vCore instance
 * running. You can deploy a free version on Azure Portal without any cost,
 * following this guide:
 * https://learn.microsoft.com/azure/cosmos-db/mongodb/vcore/quickstart-portal
 *
 * You do not need to create a database or collection, it will be created
 * automatically by the test.
 *
 * Once you have the instance running, you need to set the following environment
 * variables before running the test:
 * - AZURE_COSMOSDB_CONNECTION_STRING
 * - AZURE_OPENAI_API_KEY
 * - AZURE_OPENAI_API_INSTANCE_NAME
 * - AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME
 * - AZURE_OPENAI_API_VERSION
 *
 * A regular OpenAI key can also be used instead of Azure OpenAI.
 */
describe.skip("AzureCosmosDBVectorStore", () => {
  beforeEach(async () => {
    expect(process.env.AZURE_COSMOSDB_CONNECTION_STRING).toBeDefined();

    // Note: when using Azure OpenAI, you have to also set these variables
    // in addition to the API key:
    // - AZURE_OPENAI_API_INSTANCE_NAME
    // - AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME
    // - AZURE_OPENAI_API_VERSION
    expect(
      process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY
    ).toBeDefined();

    const client = new MongoClient(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      process.env.AZURE_COSMOSDB_CONNECTION_STRING!
    );
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = await db.createCollection(COLLECTION_NAME);

    // Make sure the database is empty
    await collection.deleteMany({});

    // Delete any existing index
    try {
      await collection.dropIndex(INDEX_NAME);
    } catch {
      // Ignore error if the index does not exist
    }

    await client.close();
  });

  test("performs similarity search", async () => {
    const vectorStore = new AzureCosmosDBVectorStore(new OpenAIEmbeddings(), {
      databaseName: DATABASE_NAME,
      collectionName: COLLECTION_NAME,
      indexName: INDEX_NAME,
      indexOptions: {
        numLists: 1,
      },
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
      1
    );

    expect(results.length).toEqual(1);
    expect(results).toMatchObject([
      { pageContent: "Sandwiches taste good.", metadata: { c: 1 } },
    ]);

    const retriever = vectorStore.asRetriever({});

    const docs = await retriever.getRelevantDocuments("house");
    expect(docs).toBeDefined();
    expect(docs[0]).toMatchObject({
      pageContent: "The house is open",
      metadata: { d: 1, e: 2 },
    });

    await vectorStore.close();
  });

  test("performs max marginal relevance search", async () => {
    const texts = ["foo", "foo", "fox"];
    const vectorStore = await AzureCosmosDBVectorStore.fromTexts(
      texts,
      {},
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        collectionName: COLLECTION_NAME,
        indexName: INDEX_NAME,
        indexOptions: {
          numLists: 1,
        },
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
      await standardRetriever.getRelevantDocuments("foo");
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

    const retrieverOutput = await retriever.getRelevantDocuments("foo");
    expect(output).toHaveLength(texts.length);

    const retrieverActual = retrieverOutput.map((doc) => doc.pageContent);
    const retrieverExpected = ["foo", "fox", "foo"];
    expect(retrieverActual).toEqual(retrieverExpected);

    const similarity = await vectorStore.similaritySearchWithScore("foo", 1);
    expect(similarity.length).toBe(1);

    await vectorStore.close();
  });

  test("deletes documents by id", async () => {
    const vectorStore = new AzureCosmosDBVectorStore(new OpenAIEmbeddings(), {
      databaseName: DATABASE_NAME,
      collectionName: COLLECTION_NAME,
      indexName: INDEX_NAME,
      indexOptions: {
        numLists: 1,
      },
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

    await vectorStore.close();
  });

  test("deletes documents by filter", async () => {
    const vectorStore = new AzureCosmosDBVectorStore(new OpenAIEmbeddings(), {
      databaseName: DATABASE_NAME,
      collectionName: COLLECTION_NAME,
      indexName: INDEX_NAME,
      indexOptions: {
        numLists: 1,
      },
    });

    await vectorStore.addDocuments([
      { pageContent: "This book is about politics", metadata: { a: 1 } },
      {
        pageContent: "The is the house of parliament",
        metadata: { d: 1, e: 2 },
      },
    ]);

    // Delete document matching the filter
    await vectorStore.delete({ filter: { a: 1 } });

    const results = await vectorStore.similaritySearch("politics", 10);

    expect(results.length).toEqual(1);
    expect(results[0].pageContent).toEqual("The is the house of parliament");

    await vectorStore.close();
  });

  test("deletes all documents", async () => {
    const vectorStore = new AzureCosmosDBVectorStore(new OpenAIEmbeddings(), {
      databaseName: DATABASE_NAME,
      collectionName: COLLECTION_NAME,
      indexName: INDEX_NAME,
      indexOptions: {
        numLists: 1,
      },
    });

    await vectorStore.addDocuments([
      { pageContent: "This book is about politics", metadata: { a: 1 } },
      {
        pageContent: "The is the house of parliament",
        metadata: { d: 1, e: 2 },
      },
    ]);

    // Delete all documents
    await vectorStore.delete();

    const results = await vectorStore.similaritySearch("politics", 10);

    expect(results.length).toEqual(0);

    await vectorStore.close();
  });
});
