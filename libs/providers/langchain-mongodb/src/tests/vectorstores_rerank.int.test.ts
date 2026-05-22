import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { Collection, MongoClient } from "mongodb";
import { setTimeout } from "timers/promises";
import { OpenAIEmbeddings, AzureOpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

import { MongoDBAtlasVectorSearch } from "../vectorstores.js";
import { isUsingLocalAtlas, uri, waitForIndexToBeQueryable } from "./utils.js";

const RERANK_MODEL = "rerank-2.5";

// $rerank requires a real Atlas cluster — skip when running against local Docker
const skipRerankTests = isUsingLocalAtlas();

// oxlint-disable-next-line no-process-env
const skipAutoEmbedRerankTests =
  isUsingLocalAtlas() || !process.env.VOYAGE_API_KEY;

function getEmbeddings() {
  if (process.env.AZURE_OPENAI_API_KEY) {
    return new AzureOpenAIEmbeddings({
      model: "text-embedding-3-small",
      azureOpenAIApiDeploymentName: "openai/deployments/text-embedding-3-small",
    });
  }
  return new OpenAIEmbeddings();
}

/**
 * Patches addDocuments to poll until all inserted docs are returned by
 * similaritySearch, so tests don't race the search index.
 */
class PatchedVectorStore extends MongoDBAtlasVectorSearch {
  async addDocuments(
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<string[]> {
    const ids = await super.addDocuments(documents, options);
    const queryEmbedding = await this.embeddings.embedQuery("sandwich");
    for (;;) {
      const results = await this.similaritySearchVectorWithScore(queryEmbedding, documents.length);
      if (results.length === documents.length) return ids;
      await setTimeout(1000);
    }
  }
}

describe.skipIf(skipRerankTests)("Rerank Tests (manual embeddings)", () => {
  let client: MongoClient;
  let collection: Collection;

  beforeAll(async () => {
    client = new MongoClient(uri(), { monitorCommands: true });
    await client.connect();

    const namespace = "langchain_test_db.langchain_rerank_test";
    const [dbName, collectionName] = namespace.split(".");
    const db = client.db(dbName);

    try {
      await db.dropCollection(collectionName);
    } catch {
      // collection may not exist yet
    }

    collection = await db.createCollection(collectionName);

    await collection.createSearchIndex({
      name: "default",
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: 1536,
            similarity: "cosine",
          },
        ],
      },
    });

    await waitForIndexToBeQueryable(collection, "default");
  });

  beforeEach(async () => {
    await collection.deleteMany({});
  });

  afterAll(async () => {
    await client.close();
  });

  test("similaritySearchWithScore returns rerankScore as a numeric score", async () => {
    const vectorStore = new PatchedVectorStore(getEmbeddings(), {
      collection,
      rerankOptions: { model: RERANK_MODEL },
    });

    await vectorStore.addDocuments([
      { pageContent: "Dogs are tough.", metadata: { a: 1 } },
      { pageContent: "Cats have fluff.", metadata: { b: 1 } },
      { pageContent: "What is a sandwich?", metadata: { c: 1 } },
      { pageContent: "That fence is purple.", metadata: { d: 1 } },
    ]);

    const results = await vectorStore.similaritySearchWithScore("Sandwich", 2);

    expect(results.length).toEqual(2);
    expect(typeof results[0][1]).toBe("number");
    expect(results[0][1]).toBeGreaterThan(0);
  });

  test("rerankScore is attached to document metadata as relevanceScore", async () => {
    const vectorStore = new PatchedVectorStore(getEmbeddings(), {
      collection,
      rerankOptions: { model: RERANK_MODEL },
    });

    await vectorStore.addDocuments([
      { pageContent: "Dogs are tough.", metadata: { a: 1 } },
      { pageContent: "Cats have fluff.", metadata: { b: 1 } },
      { pageContent: "What is a sandwich?", metadata: { c: 1 } },
      { pageContent: "That fence is purple.", metadata: { d: 1 } },
    ]);

    const results = await vectorStore.similaritySearchWithScore("Sandwich", 2);

    for (const [doc, score] of results) {
      expect(doc.metadata.relevanceScore).toBeDefined();
      expect(doc.metadata.relevanceScore).toBe(score);
    }
  });

  test("k limits the number of results returned", async () => {
    const vectorStore = new PatchedVectorStore(getEmbeddings(), {
      collection,
      rerankOptions: { model: RERANK_MODEL },
    });

    await vectorStore.addDocuments([
      { pageContent: "Dogs are tough.", metadata: { a: 1 } },
      { pageContent: "Cats have fluff.", metadata: { b: 1 } },
      { pageContent: "What is a sandwich?", metadata: { c: 1 } },
      { pageContent: "That fence is purple.", metadata: { d: 1 } },
    ]);

    const results = await vectorStore.similaritySearch("Sandwich", 1);

    expect(results.length).toEqual(1);
  });

  test("reranking improves result ordering for an ambiguous query", async () => {
    const vectorStore = new PatchedVectorStore(getEmbeddings(), {
      collection,
      rerankOptions: { model: RERANK_MODEL },
    });

    await vectorStore.addDocuments([
      { pageContent: "Dogs are tough.", metadata: {} },
      { pageContent: "Cats have fluff.", metadata: {} },
      { pageContent: "What is a sandwich?", metadata: {} },
      { pageContent: "That fence is purple.", metadata: {} },
    ]);

    const results = await vectorStore.similaritySearch("food between bread", 1);

    expect(results[0].pageContent).toEqual("What is a sandwich?");
  });
});

describe.skipIf(skipAutoEmbedRerankTests)(
  "Rerank Tests (auto-embedding + rerank)",
  () => {
    const autoEmbedModel = "voyage-4";

    let client: MongoClient;
    let collection: Collection;

    beforeAll(async () => {
      client = new MongoClient(uri(), { monitorCommands: true });
      await client.connect();

      const namespace =
        "langchain_test_db.langchain_auto_embed_rerank_test";
      const [dbName, collectionName] = namespace.split(".");
      const db = client.db(dbName);

      try {
        await db.dropCollection(collectionName);
      } catch {
        // collection may not exist yet
      }

      collection = await db.createCollection(collectionName);

      await collection.createSearchIndex({
        name: "default",
        type: "vectorSearch",
        definition: {
          fields: [
            {
              type: "autoEmbed",
              modality: "text",
              path: "text",
              model: autoEmbedModel,
            },
          ],
        },
      });

      await waitForIndexToBeQueryable(collection, "default");
    });

    beforeEach(async () => {
      await collection.deleteMany({});
    });

    afterAll(async () => {
      await client.close();
    });

    test("auto-embedding with rerank returns rerankScore in metadata", async () => {
      const vectorStore = new MongoDBAtlasVectorSearch({
        collection,
        rerankOptions: { model: RERANK_MODEL },
      });

      await vectorStore.addDocuments([
        { pageContent: "Dogs are tough.", metadata: { a: 1 } },
        { pageContent: "Cats have fluff.", metadata: { b: 1 } },
        { pageContent: "What is a sandwich?", metadata: { c: 1 } },
        { pageContent: "That fence is purple.", metadata: { d: 1 } },
      ]);

      // Poll until the auto-embed index picks up the new documents
      for (;;) {
        const probe = await vectorStore.similaritySearch("Sandwich", 4);
        if (probe.length === 4) break;
        await setTimeout(2000);
      }

      const results = await vectorStore.similaritySearchWithScore(
        "Sandwich",
        2
      );

      expect(results.length).toEqual(2);
      for (const [doc, score] of results) {
        expect(typeof score).toBe("number");
        expect(doc.metadata.relevanceScore).toBe(score);
      }
    });
  }
);
