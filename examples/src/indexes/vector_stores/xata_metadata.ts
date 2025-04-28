import { XataVectorSearch } from "@langchain/community/vectorstores/xata";
import { OpenAIEmbeddings } from "@langchain/openai";
import { BaseClient } from "@xata.io/client";
import { Document } from "@langchain/core/documents";

// First, follow set-up instructions at
// https://js.langchain.com/docs/modules/data_connection/vectorstores/integrations/xata
// Also, add a column named "author" to the "vectors" table.

// if you use the generated client, you don't need this function.
// Just import getXataClient from the generated xata.ts instead.
const getXataClient = () => {
  if (!process.env.XATA_API_KEY) {
    throw new Error("XATA_API_KEY not set");
  }

  if (!process.env.XATA_DB_URL) {
    throw new Error("XATA_DB_URL not set");
  }
  const xata = new BaseClient({
    databaseURL: process.env.XATA_DB_URL,
    apiKey: process.env.XATA_API_KEY,
    branch: process.env.XATA_BRANCH || "main",
  });
  return xata;
};

export async function run() {
  const client = getXataClient();
  const table = "vectors";
  const embeddings = new OpenAIEmbeddings();
  const store = new XataVectorSearch(embeddings, { client, table });
  // Add documents
  const docs = [
    new Document({
      pageContent: "Xata works great with Langchain.js",
      metadata: { author: "Xata" },
    }),
    new Document({
      pageContent: "Xata works great with Langchain",
      metadata: { author: "Langchain" },
    }),
    new Document({
      pageContent: "Xata includes similarity search",
      metadata: { author: "Xata" },
    }),
  ];
  const ids = await store.addDocuments(docs);

  // eslint-disable-next-line no-promise-executor-return
  await new Promise((r) => setTimeout(r, 2000));

  // author is applied as pre-filter to the similarity search
  const results = await store.similaritySearchWithScore("xata works great", 6, {
    author: "Langchain",
  });

  console.log(JSON.stringify(results, null, 2));

  await store.delete({ ids });
}
