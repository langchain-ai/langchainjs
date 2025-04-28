/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { jest, test, expect, describe, beforeAll } from "@jest/globals";

import { AzionVectorStore } from "../azion_edgesql.js";

// Increase timeout for database operations
jest.setTimeout(60000);

describe("AzionVectorStore", () => {
  let vectorStore: AzionVectorStore;
  const dbName = "langchain";
  const tableName = "documents";

  const testDocs = [
    new Document({
      pageContent: "Aspirin is good for headaches",
      metadata: { category: "medicine", type: "pain relief" },
    }),
    new Document({
      pageContent: "Ibuprofen reduces inflammation and pain",
      metadata: { category: "medicine", type: "pain relief" },
    }),
    new Document({
      pageContent: "Regular exercise helps prevent headaches",
      metadata: { category: "lifestyle", type: "prevention" },
    }),
  ];

  beforeAll(async () => {
    const embeddings = new OpenAIEmbeddings();

    // Test static factory method
    vectorStore = await AzionVectorStore.initialize(
      embeddings,
      {
        dbName,
        tableName,
      },
      {
        columns: ["category", "type"],
        mode: "hybrid",
      }
    );

    // Add test documents
    await vectorStore.addDocuments(testDocs);
  });

  test("should create vector store instance", () => {
    expect(vectorStore).toBeDefined();
    expect(vectorStore._vectorstoreType()).toBe("azionEdgeSQL");
  });

  test("should perform similarity search", async () => {
    const results = await vectorStore.azionSimilaritySearch(
      "what helps with headaches?",
      {
        kvector: 2,
        filter: [{ operator: "=", column: "category", value: "medicine" }],
        metadataItems: ["category", "type"],
      }
    );

    expect(results).toBeDefined();
    expect(results.length).toBeLessThanOrEqual(2);
    expect(results[0][0].metadata.category).toBe("medicine");
  });

  test("should perform full text search", async () => {
    const results = await vectorStore.azionFullTextSearch(
      "exercise headaches",
      {
        kfts: 1,
        filter: [{ operator: "=", column: "category", value: "lifestyle" }],
        metadataItems: ["category", "type"],
      }
    );

    expect(results).toBeDefined();
    expect(results.length).toBeLessThanOrEqual(1);
    expect(results[0][0].metadata.category).toBe("lifestyle");
  });

  test("should perform hybrid search", async () => {
    const results = await vectorStore.azionHybridSearch(
      "pain relief medicine",
      {
        kfts: 2,
        kvector: 2,
        filter: [{ operator: "=", column: "type", value: "pain relief" }],
        metadataItems: ["category", "type"],
      }
    );

    expect(results).toBeDefined();
    expect(results.length).toBeLessThanOrEqual(4);
    expect(results[0][0].metadata.type).toBe("pain relief");
  });

  test("should handle filters correctly", async () => {
    const results = await vectorStore.azionSimilaritySearch("medicine", {
      kvector: 2,
      filter: [
        { operator: "=", column: "category", value: "medicine" },
        { operator: "=", column: "type", value: "pain relief" },
      ],
      metadataItems: ["category", "type"],
    });

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    results.forEach(([doc]) => {
      expect(doc.metadata.category).toBe("medicine");
      expect(doc.metadata.type).toBe("pain relief");
    });
  });

  test("should handle empty search results", async () => {
    const results = await vectorStore.azionSimilaritySearch(
      "nonexistent content",
      {
        kvector: 2,
        filter: [{ operator: "=", column: "category", value: "nonexistent" }],
      }
    );

    expect(results).toBeDefined();
    expect(results.length).toBe(0);
  });

  test("should add new documents", async () => {
    const newDoc = new Document({
      pageContent: "Meditation can help with stress headaches",
      metadata: { category: "lifestyle", type: "stress relief" },
    });

    await vectorStore.addDocuments([newDoc]);

    const results = await vectorStore.azionFullTextSearch("meditation stress", {
      kfts: 1,
      filter: [{ operator: "=", column: "type", value: "stress relief" }],
    });

    expect(results).toBeDefined();
    expect(results.length).toBe(1);
    expect(results[0][0].pageContent).toContain("Meditation");
  });
});
