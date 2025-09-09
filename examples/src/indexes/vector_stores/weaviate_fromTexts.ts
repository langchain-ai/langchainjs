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

  // Create a store and fill it with some texts + metadata
  await WeaviateStore.fromTexts(
    ["hello world", "hi there", "how are you", "bye now"],
    [{ foo: "bar" }, { foo: "baz" }, { foo: "qux" }, { foo: "bar" }],
    new OpenAIEmbeddings(),
    {
      client,
      indexName: "Test",
      textKey: "text",
      metadataKeys: ["foo"],
    }
  );
}
