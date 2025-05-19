/* eslint-disable @typescript-eslint/no-explicit-any */
import weaviate, { ApiKey } from "weaviate-client";
import { WeaviateStore } from "@langchain/weaviate";
import { OpenAIEmbeddings } from "@langchain/openai";

export async function run() {
  // Something wrong with the weaviate-client types, so we need to disable
  const client = (weaviate as any).client({
    scheme: process.env.WEAVIATE_SCHEME || "https",
    host: process.env.WEAVIATE_HOST || "localhost",
    apiKey: new ApiKey(process.env.WEAVIATE_API_KEY || "default"),
  });
  const weaviateArgs = {
    client,
    indexName: "Test",
    metadataKeys: ["foo"],
  };
  // Create a store for an existing index
  const store = await WeaviateStore.fromExistingIndex(
    new OpenAIEmbeddings(),
    weaviateArgs
  );
  const collection = client.collections.get(weaviateArgs.indexName);
  // Search the index without any filters
  const results = await store.similaritySearch("hello world", 1);
  console.log(results);
  /*
  [ Document { pageContent: 'hello world', metadata: { foo: 'bar' } } ]
  */

  // Search the index with a filter, in this case, only return results where
  // the "foo" metadata key is equal to "baz", see the Weaviate docs for more
  // https://weaviate.io/developers/weaviate/api/graphql/filters
  const results2 = await store.similaritySearch(
    "hello world",
    1,
    collection.filter.byProperty("foo").equal("baz")
  );
  console.log(results2);
  /*
  [ Document { pageContent: 'hi there', metadata: { foo: 'baz' } } ]
  */
}
