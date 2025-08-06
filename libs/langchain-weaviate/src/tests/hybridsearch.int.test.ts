/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import weaviate, {
  WeaviateClient,
  dataType,
  tokenization,
  vectorizer,
} from "weaviate-client";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import * as dotenv from "dotenv";
import { WeaviateStore } from "../vectorstores.js";

dotenv.config();
let client: WeaviateClient;
const collectionName = "MyCollection";

beforeAll(async () => {
  expect(process.env.WEAVIATE_URL).toBeDefined();
  expect(process.env.WEAVIATE_URL!.length).toBeGreaterThan(0);
  client = await weaviate.connectToWeaviateCloud(process.env.WEAVIATE_URL!, {
    authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY || ""),
    headers: {
      "X-OpenAI-Api-Key": process.env.OPENAI_API_KEY || "",
      "X-Cohere-Api-Key": process.env.COHERE_API_KEY || "",
    },
  });
});

test("Hybridsearch with limit", async () => {
  const embeddings = new OpenAIEmbeddings();
  const schema = {
    name: collectionName,
    description: "A simple dataset",
    properties: [
      {
        name: "title",
        dataType: dataType.TEXT,
      },
      {
        name: "foo",
        dataType: dataType.TEXT,
      },
    ],
    vectorizers: vectorizer.text2VecOpenAI(),
  };
  const weaviateArgs = {
    client,
    schema,
  };
  try {
    const store = await WeaviateStore.fromTexts(
      ["hello world", "hi there", "how are you", "bye now"],
      [
        { foo: "bar" },
        { foo: "baz", title: "we have a title" },
        { foo: "qux", title: "another title" },
        { foo: "bar" },
      ],
      embeddings,
      weaviateArgs
    );

    const results = await store.hybridSearch("hello world", {
      limit: 1,
    });

    expect(results).toEqual([
      new Document({
        id: expect.any(String) as unknown as string,
        pageContent: "hello world",
        metadata: { foo: "bar", title: undefined },
      }),
    ]);
  } finally {
    await client.collections.delete(weaviateArgs.schema.name);
  }
});

test("Hybridsearch with named vectors", async () => {
  const embeddings = new OpenAIEmbeddings();
  const schemaWithNamedVectors = {
    name: collectionName,
    description: "A simple dataset",
    properties: [
      {
        name: "title",
        dataType: dataType.TEXT,
        vectorizePropertyName: true, // (Optional)
        tokenization: tokenization.LOWERCASE, // (Optional)
      },
      {
        name: "foo",
        dataType: dataType.TEXT,
      },
    ],
    vectorizers: [
      vectorizer.text2VecOpenAI({
        name: "title",
        sourceProperties: ["title"], // (Optional) Set the source property(ies)
        // vectorIndexConfig: configure.vectorIndex.hnsw()   // (Optional) Set the vector index configuration
      }),
    ],
  };
  const weaviateArgs = {
    client,
    schema: schemaWithNamedVectors,
  };
  try {
    const store = await WeaviateStore.fromTexts(
      ["hello world", "hi there", "how are you", "bye now"],
      [
        { foo: "bar" },
        { foo: "baz", title: "we have a title" },
        { foo: "qux", title: "another title" },
        { foo: "bar", title: "bye" },
      ],
      embeddings,
      weaviateArgs
    );

    const results = await store.hybridSearch("title", {
      limit: 1,
      targetVector: ["title"],
    });

    expect(results).toEqual([
      new Document({
        id: expect.any(String) as unknown as string,
        pageContent: "how are you",
        metadata: { foo: "qux", title: "another title" },
      }),
    ]);
  } finally {
    await client.collections.delete(weaviateArgs.schema.name);
  }
});

test("Hybridsearch with rerank", async () => {
  const embeddings = new OpenAIEmbeddings();
  const schemaWithReranker = {
    name: collectionName,
    description: "A simple dataset",
    properties: [
      {
        name: "title",
        dataType: dataType.TEXT,
      },
      {
        name: "foo",
        dataType: dataType.TEXT,
      },
    ],
    vectorizers: vectorizer.text2VecOpenAI(),
    reranker: weaviate.configure.reranker.cohere(),
  };
  const weaviateArgs = {
    client,
    schema: schemaWithReranker,
  };
  try {
    const store = await WeaviateStore.fromTexts(
      ["hello world", "hi there", "how are you", "bye now"],
      [
        { foo: "bar", title: "hello world" },
        { foo: "baz", title: "we have a title" },
        { foo: "qux", title: "another title" },
        { foo: "bar", title: "bye" },
      ],
      embeddings,
      weaviateArgs
    );

    const results = await store.hybridSearch("greeting", {
      limit: 1,
      rerank: {
        property: "title",
        query: "greeting",
      },
    });

    expect(results).toEqual([
      new Document({
        id: expect.any(String) as unknown as string,
        pageContent: "hello world",
        metadata: { foo: "bar", title: "hello world" },
      }),
    ]);
  } finally {
    await client.collections.delete(weaviateArgs.schema.name);
  }
});

afterAll(async () => {
  await client.close();
});
