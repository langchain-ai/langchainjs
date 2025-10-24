import { XataVectorSearch } from "@langchain/community/vectorstores/xata";
import { OpenAIEmbeddings, OpenAI } from "@langchain/openai";
import { BaseClient } from "@xata.io/client";
import { VectorDBQAChain } from "langchain/chains";
import { Document } from "@langchain/core/documents";

// First, follow set-up instructions at
// https://js.langchain.com/docs/modules/data_connection/vectorstores/integrations/xata

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
      pageContent: "Xata is a Serverless Data platform based on PostgreSQL",
    }),
    new Document({
      pageContent:
        "Xata offers a built-in vector type that can be used to store and query vectors",
    }),
    new Document({
      pageContent: "Xata includes similarity search",
    }),
  ];

  const ids = await store.addDocuments(docs);

  // eslint-disable-next-line no-promise-executor-return
  await new Promise((r) => setTimeout(r, 2000));

  const model = new OpenAI();
  const chain = VectorDBQAChain.fromLLM(model, store, {
    k: 1,
    returnSourceDocuments: true,
  });
  const response = await chain.invoke({ query: "What is Xata?" });

  console.log(JSON.stringify(response, null, 2));

  await store.delete({ ids });
}
