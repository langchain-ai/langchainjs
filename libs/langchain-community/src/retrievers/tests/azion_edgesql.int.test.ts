/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { AzionRetriever } from "@langchain/community/retrievers/azion_edgesql";
import { jest, test, expect } from "@jest/globals";

// Increase timeout to 30 seconds
jest.setTimeout(30000);

test("Azion search", async () => {
  const embeddings = new OpenAIEmbeddings();
  const entityExtractor = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
  });
  const retrieverHybrid = new AzionRetriever(embeddings, entityExtractor, {
    searchType: "hybrid",
    similarityK: 2,
    ftsK: 2,
    dbName: "langchain",
    vectorTable: "documents",
    ftsTable: "documents_fts",
  });

  expect(retrieverHybrid).toBeDefined();

  const results1 = await retrieverHybrid._getRelevantDocuments("hello");

  expect(results1.length).toBeGreaterThan(0);

  const retrieverSimilarity = new AzionRetriever(embeddings, entityExtractor, {
    searchType: "similarity",
    similarityK: 2,
    ftsK: 2,
    dbName: "langchain",
    vectorTable: "documents",
    ftsTable: "documents_fts",
  });

  const results2 = await retrieverSimilarity._getRelevantDocuments("hello");

  expect(results2.length).toBeGreaterThan(0);
});
