/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { createClient } from "@supabase/supabase-js";
import { Document } from "../../../document.js";
import { AttributeInfo } from "../../../schema/query_constructor.js";
import { OpenAIEmbeddings } from "../../../embeddings/openai.js";
import { SelfQueryRetriever } from "../index.js";
import { OpenAI } from "../../../llms/openai.js";
import { SupabaseTranslator } from "../supabase.js";
import {
  SupabaseFilter,
  SupabaseVectorStore,
} from "../../../vectorstores/supabase.js";

test("Supabase Store Self Query Retriever Test", async () => {
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
      metadata: {
        year: 2019,
        director: "Greta Gerwig",
        rating: 8.3,
        genre: "drama",
      },
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

  if (
    !process.env.SUPABASE_VECTOR_STORE_URL ||
    !process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY
  ) {
    throw new Error(
      "Supabase URL or private key not set. Please set it in the .env file"
    );
  }

  const embeddings = new OpenAIEmbeddings();
  const llm = new OpenAI();
  const documentContents = "Brief summary of a movie";
  const client = createClient(
    process.env.SUPABASE_VECTOR_STORE_URL,
    process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY
  );
  const vectorStore = new SupabaseVectorStore(embeddings, { client });
  // idempotency
  const opts = { ids: docs.map((_, idx) => idx) };
  await vectorStore.addDocuments(docs, opts);
  const selfQueryRetriever = await SelfQueryRetriever.fromLLM({
    llm,
    vectorStore,
    documentContents,
    attributeInfo,
    structuredQueryTranslator: new SupabaseTranslator(),
  });

  const query1 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are less than 90 minutes?"
  );
  console.log(query1);
  expect(query1.length).toEqual(0);
  const query2 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are rated higher than 8.5?"
  );
  console.log(query2);
  expect(query2.length).toEqual(3);
  const query3 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are directed by Greta Gerwig?"
  );
  console.log(query3);
  expect(query3.length).toEqual(1);

  const query4 = await selfQueryRetriever.getRelevantDocuments("What is what"); // this should return empty since it'll create empty filter
  console.log(query4);
  expect(query4.length).toEqual(0);
});

test("Supabase Store Self Query Retriever Test With Default Filter And Merge Operator", async () => {
  const docs = [
    new Document({
      pageContent:
        "A bunch of scientists bring back dinosaurs and mayhem breaks loose",
      metadata: {
        type: "movie",
        year: 1993,
        rating: 7.7,
        genre: "science fiction",
      },
    }),
    new Document({
      pageContent:
        "Leo DiCaprio gets lost in a dream within a dream within a dream within a ...",
      metadata: {
        type: "movie",
        year: 2010,
        director: "Christopher Nolan",
        rating: 8.2,
      },
    }),
    new Document({
      pageContent:
        "A psychologist / detective gets lost in a series of dreams within dreams within dreams and Inception reused the idea",
      metadata: {
        type: "movie",
        year: 2006,
        director: "Satoshi Kon",
        rating: 8.6,
      },
    }),
    new Document({
      pageContent:
        "A bunch of normal-sized women are supremely wholesome and some men pine after them",
      metadata: {
        type: "movie",
        year: 2019,
        director: "Greta Gerwig",
        rating: 8.3,
        genre: "drama",
      },
    }),
    new Document({
      pageContent: "Toys come alive and have a blast doing so",
      metadata: { type: "movie", year: 1995, genre: "animated" },
    }),
    new Document({
      pageContent:
        "Three men walk into the Zone, three men walk out of the Zone",
      metadata: {
        type: "movie",
        year: 1979,
        director: "Andrei Tarkovsky",
        genre: "science fiction",
        rating: 9.9,
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

  if (
    !process.env.SUPABASE_VECTOR_STORE_URL ||
    !process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY
  ) {
    throw new Error(
      "Supabase URL or private key not set. Please set it in the .env file"
    );
  }

  const embeddings = new OpenAIEmbeddings();
  const llm = new OpenAI();
  const documentContents = "Brief summary of a movie";
  const client = createClient(
    process.env.SUPABASE_VECTOR_STORE_URL,
    process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY
  );
  const vectorStore = new SupabaseVectorStore(embeddings, { client });
  // idempotency
  const opts = { ids: docs.map((_, idx) => idx) };
  await vectorStore.addDocuments(docs, opts);
  const selfQueryRetriever = await SelfQueryRetriever.fromLLM({
    llm,
    vectorStore,
    documentContents,
    attributeInfo,
    structuredQueryTranslator: new SupabaseTranslator(),
    searchParams: {
      filter: (rpc: SupabaseFilter) =>
        rpc.filter("metadata->>type", "eq", "movie"),
      mergeFiltersOperator: "and", // Supabase self-query filter does not support "or" operator for merging two filters
      k: docs.length,
    },
  });

  const query1 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are less than 90 minutes?"
  );
  console.log(query1);
  expect(query1.length).toEqual(0);
  const query2 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are rated higher than 8.5?"
  );
  console.log(query2);
  expect(query2.length).toEqual(2);
  const query3 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are directed by Greta Gerwig?"
  );
  console.log(query3);
  expect(query3.length).toEqual(1);

  const query4 = await selfQueryRetriever.getRelevantDocuments("What is what"); // query4 has to empty document, since we can't use "or" operator
  console.log(query4);
  expect(query4.length).toEqual(0);
});

test("Supabase Store Self Query Retriever Test With Default Filter Or Merge Operator", async () => {
  const docs = [
    new Document({
      pageContent:
        "A bunch of scientists bring back dinosaurs and mayhem breaks loose",
      metadata: {
        type: "movie",
        year: 1993,
        rating: 7.7,
        genre: "science fiction",
      },
    }),
    new Document({
      pageContent:
        "Leo DiCaprio gets lost in a dream within a dream within a dream within a ...",
      metadata: {
        type: "movie",
        year: 2010,
        director: "Christopher Nolan",
        rating: 8.2,
      },
    }),
    new Document({
      pageContent:
        "A psychologist / detective gets lost in a series of dreams within dreams within dreams and Inception reused the idea",
      metadata: {
        type: "movie",
        year: 2006,
        director: "Satoshi Kon",
        rating: 8.6,
      },
    }),
    new Document({
      pageContent:
        "A bunch of normal-sized women are supremely wholesome and some men pine after them",
      metadata: {
        type: "movie",
        year: 2019,
        director: "Greta Gerwig",
        rating: 8.3,
        genre: "drama",
      },
    }),
    new Document({
      pageContent: "Toys come alive and have a blast doing so",
      metadata: { type: "movie", year: 1995, genre: "animated" },
    }),
    new Document({
      pageContent:
        "Three men walk into the Zone, three men walk out of the Zone",
      metadata: {
        type: "movie",
        year: 1979,
        director: "Andrei Tarkovsky",
        genre: "science fiction",
        rating: 9.9,
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

  if (
    !process.env.SUPABASE_VECTOR_STORE_URL ||
    !process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY
  ) {
    throw new Error(
      "Supabase URL or private key not set. Please set it in the .env file"
    );
  }

  const embeddings = new OpenAIEmbeddings();
  const llm = new OpenAI();
  const documentContents = "Brief summary of a movie";
  const client = createClient(
    process.env.SUPABASE_VECTOR_STORE_URL,
    process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY
  );
  const vectorStore = new SupabaseVectorStore(embeddings, { client });
  // idempotency
  const opts = { ids: docs.map((_, idx) => idx) };
  await vectorStore.addDocuments(docs, opts);
  const selfQueryRetriever = await SelfQueryRetriever.fromLLM({
    llm,
    vectorStore,
    documentContents,
    attributeInfo,
    structuredQueryTranslator: new SupabaseTranslator(),
    searchParams: {
      filter: (rpc: SupabaseFilter) =>
        rpc
          .filter("metadata->>type", "eq", "movie")
          .filter("metadata->rating", "gt", 0.01),
      mergeFiltersOperator: "or",
      k: docs.length,
    },
  });

  const query1 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are less than 90 minutes?"
  );
  console.log(query1);
  expect(query1.length).toEqual(5);
  const query2 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are rated higher than 8.5?"
  );
  console.log(query2);
  expect(query2.length).toEqual(6);
  const query3 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are directed by Greta Gerwig?"
  );
  console.log(query3);
  expect(query3.length).toEqual(5);

  const query4 = await selfQueryRetriever.getRelevantDocuments("What is what");
  console.log(query4);
  expect(query4.length).toEqual(5);
});

test("Supabase Store Self Query Retriever Test With Default Filter And Merge Operator, Object default filter", async () => {
  const docs = [
    new Document({
      pageContent:
        "A bunch of scientists bring back dinosaurs and mayhem breaks loose",
      metadata: {
        type: "movie",
        year: 1993,
        rating: 7.7,
        genre: "science fiction",
      },
    }),
    new Document({
      pageContent:
        "Leo DiCaprio gets lost in a dream within a dream within a dream within a ...",
      metadata: {
        type: "movie",
        year: 2010,
        director: "Christopher Nolan",
        rating: 8.2,
      },
    }),
    new Document({
      pageContent:
        "A psychologist / detective gets lost in a series of dreams within dreams within dreams and Inception reused the idea",
      metadata: {
        type: "movie",
        year: 2006,
        director: "Satoshi Kon",
        rating: 8.6,
      },
    }),
    new Document({
      pageContent:
        "A bunch of normal-sized women are supremely wholesome and some men pine after them",
      metadata: {
        type: "movie",
        year: 2019,
        director: "Greta Gerwig",
        rating: 8.3,
        genre: "drama",
      },
    }),
    new Document({
      pageContent: "Toys come alive and have a blast doing so",
      metadata: { type: "movie", year: 1995, genre: "animated" },
    }),
    new Document({
      pageContent:
        "Three men walk into the Zone, three men walk out of the Zone",
      metadata: {
        type: "movie",
        year: 1979,
        director: "Andrei Tarkovsky",
        genre: "science fiction",
        rating: 9.9,
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

  if (
    !process.env.SUPABASE_VECTOR_STORE_URL ||
    !process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY
  ) {
    throw new Error(
      "Supabase URL or private key not set. Please set it in the .env file"
    );
  }

  const embeddings = new OpenAIEmbeddings();
  const llm = new OpenAI();
  const documentContents = "Brief summary of a movie";
  const client = createClient(
    process.env.SUPABASE_VECTOR_STORE_URL,
    process.env.SUPABASE_VECTOR_STORE_PRIVATE_KEY
  );
  const vectorStore = new SupabaseVectorStore(embeddings, { client });
  // idempotency
  const opts = { ids: docs.map((_, idx) => idx) };
  await vectorStore.addDocuments(docs, opts);
  const selfQueryRetriever = await SelfQueryRetriever.fromLLM({
    llm,
    vectorStore,
    documentContents,
    attributeInfo,
    structuredQueryTranslator: new SupabaseTranslator(),
    searchParams: {
      filter: {
        type: "movie",
      },
      mergeFiltersOperator: "and", // Supabase self-query filter does not support "or" operator for merging two filters
      k: docs.length,
    },
  });

  const query1 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are less than 90 minutes?"
  );
  console.log(query1);
  expect(query1.length).toEqual(0);
  const query2 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are rated higher than 8.5?"
  );
  console.log(query2);
  expect(query2.length).toEqual(2);
  const query3 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are directed by Greta Gerwig?"
  );
  console.log(query3);
  expect(query3.length).toEqual(1);

  const query4 = await selfQueryRetriever.getRelevantDocuments("What is what"); // query4 has to empty document, since we can't use "or" operator
  console.log(query4);
  expect(query4.length).toEqual(0);
});
