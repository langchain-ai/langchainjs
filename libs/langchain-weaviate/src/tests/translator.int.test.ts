/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import weaviate, { Filters, WeaviateClient } from "weaviate-client";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { AttributeInfo } from "langchain/chains/query_constructor";
import { SelfQueryRetriever } from "langchain/retrievers/self_query";
import { WeaviateStore } from "../vectorstores.js";
import { WeaviateTranslator } from "../translator.js";

let client: WeaviateClient;
const indexName = "TestTranslate";

beforeAll(async () => {
  expect(process.env.WEAVIATE_URL).toBeDefined();
  expect(process.env.WEAVIATE_URL!.length).toBeGreaterThan(0);

  client = await weaviate.connectToWeaviateCloud(process.env.WEAVIATE_URL!, {
    authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY || ""),
    headers: {
      "X-OpenAI-Api-Key": process.env.OPENAI_API_KEY || "",
      "X-Azure-Api-Key": process.env.AZURE_OPENAI_API_KEY || "",
    },
  });
});

test("Weaviate Self Query Retriever Test", async () => {
  const docs = [
    new Document({
      pageContent:
        "A bunch of scientists bring back dinosaurs and mayhem breaks loose",
      metadata: { year: 1993, rating: 7.7, genre: "science fiction" },
    }),
    new Document({
      pageContent:
        "Leo DiCaprio gets lost in a dream within a dream within a dream within a ...",
      metadata: { year: 2010, director: "Christopher Nolan", rating: 8.2 },
    }),
    new Document({
      pageContent:
        "A psychologist / detective gets lost in a series of dreams within dreams within dreams and Inception reused the idea",
      metadata: { year: 2006, director: "Satoshi Kon", rating: 8.6 },
    }),
    new Document({
      pageContent:
        "A bunch of normal-sized women are supremely wholesome and some men pine after them",
      metadata: { year: 2019, director: "Greta Gerwig", rating: 8.3 },
    }),
    new Document({
      pageContent: "Toys come alive and have a blast doing so",
      metadata: { year: 1995, genre: "animated" },
    }),
    new Document({
      pageContent:
        "Three men walk into the Zone, three men walk out of the Zone",
      metadata: {
        year: 1979,
        director: "Andrei Tarkovsky",
        genre: "science fiction",
        rating: 9.9,
      },
    }),
  ];

  const attributeInfo: AttributeInfo[] = [
    {
      name: "genre",
      description: "The genre of the movie",
      type: "string or array of strings",
    },
    {
      name: "year",
      description: "The year the movie was released",
      type: "number",
    },
    {
      name: "director",
      description: "The director of the movie",
      type: "string",
    },
    {
      name: "rating",
      description: "The rating of the movie (1-10)",
      type: "number",
    },
    {
      name: "length",
      description: "The length of the movie in minutes",
      type: "number",
    },
  ];

  const embeddings = new OpenAIEmbeddings();
  const llm = new ChatOpenAI({
    model: "gpt-3.5-turbo",
  });
  const weaviateArgs = {
    client,
    indexName,
    textKey: "text",
    metadataKeys: ["year", "director", "rating", "genre"],
  };
  const documentContents = "Brief summary of a movie";
  try {
    const vectorStore = await WeaviateStore.fromDocuments(
      docs,
      embeddings,
      weaviateArgs
    );
    const selfQueryRetriever = SelfQueryRetriever.fromLLM({
      llm,
      vectorStore,
      documentContents,
      attributeInfo,
      structuredQueryTranslator: new WeaviateTranslator(),
    });

    const query2 = await selfQueryRetriever.invoke(
      "Which movies are rated higher than 8.5?"
    );
    // this query isn't correctly converted by Langchain selfQuery
    // const _query3 = await selfQueryRetriever.invoke(
    //   "Which movies are directed by Greta Gerwig?"
    // );
    const query4 = await selfQueryRetriever.invoke(
      "Wau wau wau wau hello gello hello?"
    );
    // weaviate will always return results but with lesser score
    expect(query4.length).toBe(4);
    expect(query2.length).toBe(2);
  } finally {
    await client.collections.delete(indexName);
  }
});

test.skip("Weaviate Vector Store Self Query Retriever Test With Default Filter Or Merge Operator", async () => {
  const docs = [
    new Document({
      pageContent:
        "A bunch of scientists bring back dinosaurs and mayhem breaks loose",
      metadata: {
        year: 1993,
        rating: 7.7,
        genre: "science fiction",
        type: "movie",
      },
    }),
    new Document({
      pageContent:
        "Leo DiCaprio gets lost in a dream within a dream within a dream within a ...",
      metadata: {
        year: 2010,
        director: "Christopher Nolan",
        rating: 8.2,
        type: "movie",
      },
    }),
    new Document({
      pageContent:
        "A psychologist / detective gets lost in a series of dreams within dreams within dreams and Inception reused the idea",
      metadata: {
        year: 2006,
        director: "Satoshi Kon",
        rating: 8.6,
        type: "movie",
      },
    }),
    new Document({
      pageContent:
        "A bunch of normal-sized women are supremely wholesome and some men pine after them",
      metadata: {
        year: 2019,
        director: "Greta Gerwig",
        rating: 8.3,
        type: "movie",
      },
    }),
    new Document({
      pageContent: "Toys come alive and have a blast doing so",
      metadata: { year: 1995, genre: "animated", type: "movie" },
    }),
    new Document({
      pageContent:
        "Three men walk into the Zone, three men walk out of the Zone",
      metadata: {
        year: 1979,
        director: "Andrei Tarkovsky",
        genre: "science fiction",
        rating: 9.9,
        type: "movie",
      },
    }),
    new Document({
      pageContent: "10x the previous gecs",
      metadata: {
        year: 2023,
        title: "10000 gecs",
        artist: "100 gecs",
        rating: 9.9,
        type: "album",
      },
    }),
  ];

  const attributeInfo: AttributeInfo[] = [
    {
      name: "genre",
      description: "The genre of the movie",
      type: "string or array of strings",
    },
    {
      name: "year",
      description: "The year the movie was released",
      type: "number",
    },
    {
      name: "director",
      description: "The director of the movie",
      type: "string",
    },
    {
      name: "rating",
      description: "The rating of the movie (1-10)",
      type: "number",
    },
    {
      name: "length",
      description: "The length of the movie in minutes",
      type: "number",
    },
  ];

  const embeddings = new OpenAIEmbeddings();
  const llm = new ChatOpenAI({
    model: "gpt-3.5-turbo",
  });
  const weaviateArgs = {
    client,
    indexName,
    textKey: "text",
    metadataKeys: ["year", "director", "rating", "genre", "type"],
  };
  const documentContents = "Brief summary of a movie";
  const vectorStore = await WeaviateStore.fromDocuments(
    docs,
    embeddings,
    weaviateArgs
  );

  const collection = client.collections.get(weaviateArgs.indexName);
  try {
    const selfQueryRetriever = SelfQueryRetriever.fromLLM({
      llm,
      vectorStore,
      documentContents,
      attributeInfo,
      structuredQueryTranslator: new WeaviateTranslator(),
      searchParams: {
        filter: Filters.and(
          collection.filter.byProperty("type").equal("movie")
        ),
        mergeFiltersOperator: "or",
        k: docs.length,
      },
    });

    const query4 = await selfQueryRetriever.invoke(
      "Wau wau wau wau hello gello hello?"
    );
    // query4 has to return documents, since the default filter takes over with
    expect(query4.length).toEqual(7);
  } finally {
    await client.collections.delete(indexName);
  }
});

test("Weaviate Vector Store Self Query Retriever Test With Default Filter And Merge Operator", async () => {
  const docs = [
    new Document({
      pageContent:
        "A bunch of scientists bring back dinosaurs and mayhem breaks loose",
      metadata: {
        year: 1993,
        rating: 7.7,
        genre: "science fiction",
        type: "movie",
      },
    }),
    new Document({
      pageContent:
        "Leo DiCaprio gets lost in a dream within a dream within a dream within a ...",
      metadata: {
        year: 2010,
        director: "Christopher Nolan",
        rating: 8.2,
        type: "movie",
      },
    }),
    new Document({
      pageContent:
        "A psychologist / detective gets lost in a series of dreams within dreams within dreams and Inception reused the idea",
      metadata: {
        year: 2006,
        director: "Satoshi Kon",
        rating: 8.6,
        type: "movie",
      },
    }),
    new Document({
      pageContent:
        "A bunch of normal-sized women are supremely wholesome and some men pine after them",
      metadata: {
        year: 2019,
        director: "Greta Gerwig",
        rating: 8.3,
        type: "movie",
      },
    }),
    new Document({
      pageContent: "Toys come alive and have a blast doing so",
      metadata: { year: 1995, genre: "animated", type: "movie" },
    }),
    new Document({
      pageContent:
        "Three men walk into the Zone, three men walk out of the Zone",
      metadata: {
        year: 1979,
        director: "Andrei Tarkovsky",
        genre: "science fiction",
        rating: 9.9,
        type: "movie",
      },
    }),
    new Document({
      pageContent: "10x the previous gecs",
      metadata: {
        year: 2023,
        title: "10000 gecs",
        artist: "100 gecs",
        rating: 9.9,
        type: "album",
      },
    }),
  ];

  const attributeInfo: AttributeInfo[] = [
    {
      name: "genre",
      description: "The genre of the movie",
      type: "string or array of strings",
    },
    {
      name: "year",
      description: "The year the movie was released",
      type: "number",
    },
    {
      name: "director",
      description: "The director of the movie",
      type: "string",
    },
    {
      name: "rating",
      description: "The rating of the movie (1-10)",
      type: "number",
    },
    {
      name: "length",
      description: "The length of the movie in minutes",
      type: "number",
    },
  ];

  const embeddings = new OpenAIEmbeddings();
  const llm = new ChatOpenAI({
    model: "gpt-3.5-turbo",
  });
  expect(process.env.WEAVIATE_URL).toBeDefined();
  expect(process.env.WEAVIATE_URL!.length).toBeGreaterThan(0);

  const client = await weaviate.connectToWeaviateCloud(
    process.env.WEAVIATE_URL!,
    {
      authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY || ""),
      headers: {
        "X-OpenAI-Api-Key": process.env.OPENAI_API_KEY || "",
        "X-Azure-Api-Key": process.env.AZURE_OPENAI_API_KEY || "",
      },
    }
  );
  const weaviateArgs = {
    client,
    indexName,
    textKey: "text",
    metadataKeys: ["year", "director", "rating", "genre", "type"],
  };

  try {
    const documentContents = "Brief summary of a movie";
    const vectorStore = await WeaviateStore.fromDocuments(
      docs,
      embeddings,
      weaviateArgs
    );
    const collection = client.collections.get(weaviateArgs.indexName);
    const selfQueryRetriever = SelfQueryRetriever.fromLLM({
      llm,
      vectorStore,
      documentContents,
      attributeInfo,
      structuredQueryTranslator: new WeaviateTranslator(),
      searchParams: {
        filter: Filters.and(
          collection.filter.byProperty("type").equal("movie")
        ),
        mergeFiltersOperator: "and",
        k: docs.length,
      },
    });

    const query4 = await selfQueryRetriever.invoke(
      "Wau wau wau wau hello gello hello?"
    );
    // query4 has to return empty array, since the default filter takes over with and filter
    expect(query4.length).toEqual(7);
  } finally {
    await client.collections.delete(indexName);
  }
});

afterAll(async () => {
  await client.close();
});
