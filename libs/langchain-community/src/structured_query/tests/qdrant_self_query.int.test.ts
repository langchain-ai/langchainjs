import { test } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings, OpenAI } from "@langchain/openai";
import { AttributeInfo } from "langchain/chains/query_constructor";
import { SelfQueryRetriever } from "langchain/retrievers/self_query";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "../../vectorstores/qdrant.js";
import { QdrantTranslator } from "../qdrant.js";

test("Qdrant Vector Store Self Query Retriever Test", async () => {
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
  const llm = new OpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0,
  });
  const documentContents = "Brief summary of a movie";
  const client = new QdrantClient({ url: "http://127.0.0.1:6333" });
  const vectorStore = await QdrantVectorStore.fromDocuments(docs, embeddings, {
    client,
    collectionName: crypto.randomUUID(),
  });
  const selfQueryRetriever = SelfQueryRetriever.fromLLM({
    llm,
    vectorStore,
    documentContents,
    attributeInfo,
    structuredQueryTranslator: new QdrantTranslator(),
  });

  const query1 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are less than 90 minutes?"
  );

  expect(query1.length).toEqual(0);

  const query2 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are rated higher than 8.5?"
  );

  expect(query2.length).toEqual(2);

  const query3 = await selfQueryRetriever.getRelevantDocuments(
    "Which cool movies are directed by Greta Gerwig?"
  );

  expect(query3.length).toEqual(1);
});

test("Qdrant Vector Store Self Query Retriever Test With Default Filter Or Merge Operator", async () => {
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
  const llm = new OpenAI({
    modelName: "gpt-3.5-turbo",
  });
  const documentContents = "Brief summary of a movie";
  const client = new QdrantClient({ url: "http://127.0.0.1:6333" });
  const vectorStore = await QdrantVectorStore.fromDocuments(docs, embeddings, {
    client,
    collectionName: crypto.randomUUID(),
  });
  const selfQueryRetriever = SelfQueryRetriever.fromLLM({
    llm,
    vectorStore,
    documentContents,
    attributeInfo,
    structuredQueryTranslator: new QdrantTranslator(),
    searchParams: {
      filter: {
        must: [{ key: "metadata.type", match: { value: "movie" } }],
      },
      mergeFiltersOperator: "or",
      k: docs.length,
    },
  });

  const query1 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are less than 90 minutes?"
  );

  expect(query1.length).toEqual(6);

  const query2 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are rated higher than 8.5?"
  );

  expect(query2.length).toEqual(7);

  const query3 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are directed by Greta Gerwig?"
  );

  expect(query3.length).toEqual(6);

  const query4 = await selfQueryRetriever.getRelevantDocuments(
    "Awawawa au au au wawawawa hello?"
  );

  expect(query4.length).toEqual(6); // this one should return documents since default filter takes over
});

test("Qdrant Vector Store Self Query Retriever Test With Default Filter And Merge Operator", async () => {
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
  const llm = new OpenAI({
    modelName: "gpt-3.5-turbo",
  });
  const documentContents = "Brief summary of a movie";
  const client = new QdrantClient({ url: "http://127.0.0.1:6333" });
  const vectorStore = await QdrantVectorStore.fromDocuments(docs, embeddings, {
    client,
    collectionName: crypto.randomUUID(),
  });
  const selfQueryRetriever = SelfQueryRetriever.fromLLM({
    llm,
    vectorStore,
    documentContents,
    attributeInfo,
    structuredQueryTranslator: new QdrantTranslator(),
    searchParams: {
      filter: {
        must: [{ key: "metadata.type", match: { value: "movie" } }],
      },
      mergeFiltersOperator: "and",
      k: docs.length,
    },
  });

  const query1 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are less than 90 minutes?"
  );

  expect(query1.length).toEqual(0);

  const query2 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are rated higher than 8.5?"
  );

  expect(query2.length).toEqual(2);

  const query3 = await selfQueryRetriever.getRelevantDocuments(
    "Which cool movies are directed by Greta Gerwig?"
  );

  expect(query3.length).toEqual(1);

  const query4 = await selfQueryRetriever.getRelevantDocuments(
    "Awawawa au au au wawawawa hello?"
  );

  expect(query4.length).toBeGreaterThan(0); // this one should return documents since default filter takes over
});
