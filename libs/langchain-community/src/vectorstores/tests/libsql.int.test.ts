import { expect, test } from "@jest/globals";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { createClient } from "@libsql/client";

import { LibSQLVectorStore } from "../libsql.js";

test("can create and query", async () => {
  const client = createClient({
    url: process.env.LIBSQL_URL!,
    authToken: process.env.LIBSQL_AUTH_TOKEN,
  });
  const vectorStore = new LibSQLVectorStore(
    new OpenAIEmbeddings({
      model: "text-embedding-3-small",
      dimensions: 1536,
    }),
    {
      db: client,
      table: "documents",
      column: "embeddings",
    }
  );
  const ids = await vectorStore.addDocuments([
    new Document({
      pageContent: "added first page",
    }),
    new Document({
      pageContent: "added second page",
    }),
    new Document({
      pageContent: "added third page",
    }),
  ]);
  const nextId = await vectorStore.addDocuments([
    new Document({
      pageContent: "added another first page",
    }),
  ]);
  ids.push(nextId[0]);
  const results = await vectorStore.similaritySearchWithScore("added first", 4);
  expect(results.length).toBe(4);
});
