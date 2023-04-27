/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import weaviate from "weaviate-ts-client";
import { WeaviateStore } from "../weaviate.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { Document } from "../../document.js";

test.skip("WeaviateStore", async () => {
  // Something wrong with the weaviate-ts-client types, so we need to disable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (weaviate as any).client({
    scheme: process.env.WEAVIATE_SCHEME || "https",
    host: process.env.WEAVIATE_HOST || "localhost",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiKey: new (weaviate as any).ApiKey(
      process.env.WEAVIATE_API_KEY || "default"
    ),
  });
  const store = await WeaviateStore.fromTexts(
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

  const results = await store.similaritySearch("hello world", 1);
  expect(results).toEqual([
    new Document({ pageContent: "hello world", metadata: { foo: "bar" } }),
  ]);

  const results2 = await store.similaritySearch("hello world", 1, {
    where: {
      operator: "Equal",
      path: ["foo"],
      valueText: "baz",
    },
  });
  expect(results2).toEqual([
    new Document({ pageContent: "hi there", metadata: { foo: "baz" } }),
  ]);

  const testDocumentWithObjectMetadata = new Document({
    pageContent: "this is the deep document world!",
    metadata: {
      deep: {
        string: "deep string",
        deepdeep: {
          string: "even a deeper string",
        },
      },
    },
  });
  const documentStore = await WeaviateStore.fromDocuments(
    [testDocumentWithObjectMetadata],
    new OpenAIEmbeddings(),
    {
      client,
      indexName: "DocumentTest",
      textKey: "text",
      metadataKeys: ["deep.string", "deep.deepdeep.string"],
    }
  );

  const result3 = await documentStore.similaritySearch(
    "this is the deep document world!",
    1,
    {
      where: {
        operator: "Equal",
        path: ["deep.string"],
        valueText: "deep string",
      },
    }
  );
  expect(result3).toEqual([
    new Document({
      pageContent: "this is the deep document world!",
      metadata: {
        "deep.string": "deep string",
        "deep.deepdeep.string": "even a deeper string",
      },
    }),
  ]);
});
