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
  if (process.env.WEAVIATE_URL === "local") {
    client = await weaviate.connectToLocal({
      headers: {
        "X-OpenAI-Api-Key": process.env.OPENAI_API_KEY || "",
        "X-Cohere-Api-Key": process.env.COHERE_API_KEY || "",
      },
    });
  } else {
    client = await weaviate.connectToWeaviateCloud(process.env.WEAVIATE_URL!, {
      authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY || ""),
      headers: {
        "X-OpenAI-Api-Key": process.env.OPENAI_API_KEY || "",
        "X-Cohere-Api-Key": process.env.COHERE_API_KEY || "",
      },
    });
  }
  await client.collections.delete("MyCollection");
  console.log("Connecting to Weaviate at", process.env.WEAVIATE_URL);
  console.log("Ready?", await client.isReady());
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
    indexName: "HybridSearchWithLimit",
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
        metadata: { foo: "bar", title: undefined, score: expect.any(Number) },
      }),
    ]);
  } finally {
    await client.collections.delete(weaviateArgs.indexName);
  }
});

test("Hybridsearch with named vectors", async () => {
  await client.collections.delete(collectionName);
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

    // how are you in portuguese
    const results = await store.hybridSearch("como você está?", {
      limit: 1,
      targetVector: ["title"],
    });

    expect(results).toEqual([
      new Document({
        id: expect.any(String) as unknown as string,
        pageContent: "how are you",
        metadata: {
          foo: "qux",
          title: "another title",
          score: expect.any(Number),
        },
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
        metadata: {
          foo: "bar",
          title: "hello world",
          rerankScore: expect.any(Number),
          score: expect.any(Number),
        },
      }),
    ]);
  } finally {
    await client.collections.delete(weaviateArgs.schema.name);
  }
});

test("HybridSearch providing vector and return metadata", async () => {
  const embeddings = new OpenAIEmbeddings();
  const weaviateArgs = {
    client,
    indexName: "HybridSearchProvidingVector",
  };
  try {
    const store = await WeaviateStore.fromTexts(
      ["a dog can bark", "what more?", "How many is enough?"],
      [{ foo: "bar" }],
      embeddings,
      weaviateArgs
    );

    const results = await store.hybridSearch("domestic dog", {
      alpha: 0.75,
      autoLimit: 1,
      vector: await embeddings.embedQuery("domestic dog"),
      returnMetadata: ["explainScore", "creationTime"],
    });

    expect(results).toEqual([
      new Document({
        id: expect.any(String) as unknown as string,
        pageContent: "a dog can bark",
        metadata: {
          score: 1,
          foo: "bar",
          explainScore: expect.any(String),
          creationTime: expect.any(Date),
        },
      }),
    ]);
  } finally {
    await client.collections.delete(weaviateArgs.indexName);
  }
});

afterAll(async () => {
  await client.close();
});
