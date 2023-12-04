/* eslint-disable @typescript-eslint/no-explicit-any */
import weaviate from "weaviate-ts-client";
import { WeaviateStore } from "langchain/vectorstores/weaviate";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

export async function run() {
  // Something wrong with the weaviate-ts-client types, so we need to disable
  const client = (weaviate as any).client({
    scheme: process.env.WEAVIATE_SCHEME || "https",
    host: process.env.WEAVIATE_HOST || "localhost",
    apiKey: new (weaviate as any).ApiKey(
      process.env.WEAVIATE_API_KEY || "default"
    ),
  });

  // Create a store for an existing index
  const store = await WeaviateStore.fromExistingIndex(new OpenAIEmbeddings(), {
    client,
    indexName: "Test",
    metadataKeys: ["foo"],
  });

  const resultOne = await store.maxMarginalRelevanceSearch("Hello world", {
    k: 1,
  });

  console.log(resultOne);
}
