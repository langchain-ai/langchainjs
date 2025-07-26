/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { jest, test, expect } from "@jest/globals";
import { AzionRetriever } from "../azion_edgesql.js";

// Increase timeout to 30 seconds
jest.setTimeout(30000);

test("Azion search", async () => {
  const embeddings = new OpenAIEmbeddings();
  const entityExtractor = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  });
  const retrieverHybrid = new AzionRetriever(embeddings, {
    searchType: "hybrid",
    similarityK: 2,
    ftsK: 2,
    dbName: "langchain",
    vectorTable: "documents",
    ftsTable: "documents_fts",
    entityExtractor,
  });

  expect(retrieverHybrid).toBeDefined();

  const results1 = await retrieverHybrid.invoke("hello");

  expect(results1.length).toBeGreaterThan(0);

  const retrieverSimilarity = new AzionRetriever(embeddings, {
    searchType: "similarity",
    similarityK: 2,
    ftsK: 2,
    dbName: "langchain",
    vectorTable: "documents",
    ftsTable: "documents_fts",
    entityExtractor,
  });

  const results2 = await retrieverSimilarity.invoke("hello");

  expect(results2.length).toBeGreaterThan(0);
});
