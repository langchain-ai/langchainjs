/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import weaviate, {
  WeaviateClient,
  dataType,
  vectorizer,
} from "weaviate-client";
import { OpenAIEmbeddings } from "@langchain/openai";
import * as dotenv from "dotenv";
import { WeaviateStore } from "../vectorstores.js";

dotenv.config();
let client: WeaviateClient;
const collectionName = "GenerateCollection";

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
  console.log("Connecting to Weaviate at", process.env.WEAVIATE_URL);
  console.log("Ready?", await client.isReady());
});

test("Generate with limit", async () => {
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
    generative: weaviate.configure.generative.openAI(),
  };
  const weaviateArgs = {
    client,
    schema,
  };
  try {
    const store = await WeaviateStore.fromTexts(
      ["hello world", "hi there", "how are you", "bye now"],
      [
        { foo: "bar", title: "hello world" },
        { foo: "baz", title: "we have a title" },
        { foo: "qux", title: "another title" },
      ],
      embeddings,
      weaviateArgs
    );

    const results = await store.generate(
      "hello world",
      {
        singlePrompt: {
          prompt: "Translate this into German: {title}",
        },
      },
      {
        limit: 1,
      }
    );
    expect(results).toEqual([
      expect.objectContaining({
        pageContent: "hello world",
        metadata: { foo: "bar", title: "hello world" },
        generated: "Hallo Welt",
        additional: expect.any(Object),
        vectors: expect.any(Object),
        id: expect.any(String),
      }),
    ]);
  } finally {
    await client.collections.delete(weaviateArgs.schema.name);
  }
});

afterAll(async () => {
  await client.close();
});
