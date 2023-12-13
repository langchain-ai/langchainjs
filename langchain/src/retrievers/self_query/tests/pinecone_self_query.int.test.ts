/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-promise-executor-return */
import { test } from "@jest/globals";
import { Pinecone } from "@pinecone-database/pinecone";
import { Document } from "../../../document.js";
import { AttributeInfo } from "../../../schema/query_constructor.js";
import { OpenAIEmbeddings } from "../../../embeddings/openai.js";
import { SelfQueryRetriever } from "../index.js";
import { PineconeTranslator } from "../pinecone.js";
import { OpenAI } from "../../../llms/openai.js";
import { PineconeStore } from "../../../vectorstores/pinecone.js";

describe("Pinecone self query", () => {
  const testIndexName = process.env.PINECONE_INDEX!;

  test("Pinecone Store Self Query Retriever Test", async () => {
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
          "Leo DiCaprio gets lost in a dream wi thin a dream within a dream within a ...",
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
      !process.env.PINECONE_API_KEY ||
      !process.env.PINECONE_ENVIRONMENT ||
      !testIndexName
    ) {
      throw new Error(
        "PINECONE_ENVIRONMENT and PINECONE_API_KEY and PINECONE_INDEX must be set"
      );
    }

    const env = process.env.PINECONE_ENVIRONMENT;
    const key = process.env.PINECONE_API_KEY;

    const pinecone = new Pinecone({
      apiKey: key,
      environment: env,
    });

    const index = pinecone.Index(testIndexName);

    const embeddings = new OpenAIEmbeddings();
    const llm = new OpenAI();
    const documentContents = "Brief summary of a movie";
    const vectorStore = await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
    });
    const selfQueryRetriever = await SelfQueryRetriever.fromLLM({
      llm,
      vectorStore,
      documentContents,
      attributeInfo,
      structuredQueryTranslator: new PineconeTranslator(),
    });

    const query1 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are less than 90 minutes?"
    );
    const query2 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are rated higher than 8.5?"
    );
    const query3 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are directed by Greta Gerwig?"
    );
    const query4 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are either comedy or drama and are less than 90 minutes?"
    );
    const query5 = await selfQueryRetriever.getRelevantDocuments(
      "Awawawawa hello hello hello huh where am i?"
    );
    console.log(query1, query2, query3, query4, query5); // query 5 should return empty array
    expect(query5.length).toBe(0);
  });

  test("Pinecone Store Self Query Retriever Test With Default Filter Or Merge Operator", async () => {
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

    if (
      !process.env.PINECONE_API_KEY ||
      !process.env.PINECONE_ENVIRONMENT ||
      !testIndexName
    ) {
      throw new Error(
        "PINECONE_ENVIRONMENT and PINECONE_API_KEY and PINECONE_INDEX must be set"
      );
    }

    const env = process.env.PINECONE_ENVIRONMENT;
    const key = process.env.PINECONE_API_KEY;

    const pinecone = new Pinecone({
      apiKey: key,
      environment: env,
    });

    const index = pinecone.Index(testIndexName);

    const embeddings = new OpenAIEmbeddings();
    const llm = new OpenAI();
    const documentContents = "Brief summary of a movie";
    const vectorStore = await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
    });
    const selfQueryRetriever = await SelfQueryRetriever.fromLLM({
      llm,
      vectorStore,
      documentContents,
      attributeInfo,
      structuredQueryTranslator: new PineconeTranslator(),
      searchParams: {
        filter: {
          type: "movie",
        },
        mergeFiltersOperator: "or",
      },
    });

    const query1 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are less than 90 minutes?"
    );
    const query2 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are rated higher than 8.5?"
    );
    const query3 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are directed by Greta Gerwig?"
    );
    const query4 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are either comedy or drama and are less than 90 minutes?"
    );
    const query5 = await selfQueryRetriever.getRelevantDocuments(
      "Awawawawa hello hello hello huh where am i?"
    );
    console.log(query1, query2, query3, query4, query5); // query 5 should return documents
    expect(query5.length).toBeGreaterThan(0);
  });

  test("Pinecone Store Self Query Retriever Test With Default Filter And Merge Operator", async () => {
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

    if (
      !process.env.PINECONE_API_KEY ||
      !process.env.PINECONE_ENVIRONMENT ||
      !testIndexName
    ) {
      throw new Error(
        "PINECONE_ENVIRONMENT and PINECONE_API_KEY and PINECONE_INDEX must be set"
      );
    }

    const env = process.env.PINECONE_ENVIRONMENT;
    const key = process.env.PINECONE_API_KEY;

    const pinecone = new Pinecone({
      apiKey: key,
      environment: env,
    });

    const index = pinecone.Index(testIndexName);

    const embeddings = new OpenAIEmbeddings();
    const llm = new OpenAI();
    const documentContents = "Brief summary of a movie";
    const vectorStore = await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
    });
    const selfQueryRetriever = await SelfQueryRetriever.fromLLM({
      llm,
      vectorStore,
      documentContents,
      attributeInfo,
      structuredQueryTranslator: new PineconeTranslator(),
      searchParams: {
        filter: {
          type: "movie",
        },
        mergeFiltersOperator: "and",
      },
    });

    const query1 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are less than 90 minutes?"
    );
    const query2 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are rated higher than 8.5?"
    );
    const query3 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are directed by Greta Gerwig?"
    );
    const query4 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are either comedy or drama and are less than 90 minutes?"
    );
    const query5 = await selfQueryRetriever.getRelevantDocuments(
      "Awawawawa hello hello hello huh where am i?"
    );
    console.log(query1, query2, query3, query4, query5); // query 5 should return empty array
    expect(query5.length).toEqual(0);
  });

  test("Pinecone Store Self Query Retriever Test With Default Filter And Merge Operator With Force Default Filter", async () => {
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

    if (
      !process.env.PINECONE_API_KEY ||
      !process.env.PINECONE_ENVIRONMENT ||
      !testIndexName
    ) {
      throw new Error(
        "PINECONE_ENVIRONMENT and PINECONE_API_KEY and PINECONE_INDEX must be set"
      );
    }

    const env = process.env.PINECONE_ENVIRONMENT;
    const key = process.env.PINECONE_API_KEY;

    const pinecone = new Pinecone({
      apiKey: key,
      environment: env,
    });

    const index = pinecone.Index(testIndexName);

    const embeddings = new OpenAIEmbeddings();
    const llm = new OpenAI();
    const documentContents = "Brief summary of a movie";
    const vectorStore = await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
    });
    const selfQueryRetriever = await SelfQueryRetriever.fromLLM({
      llm,
      vectorStore,
      documentContents,
      attributeInfo,
      structuredQueryTranslator: new PineconeTranslator(),
      searchParams: {
        filter: {
          type: "movie",
        },
        mergeFiltersOperator: "and",
        forceDefaultFilter: true,
      },
    });

    const query1 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are less than 90 minutes?"
    );
    const query2 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are rated higher than 8.5?"
    );
    const query3 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are directed by Greta Gerwig?"
    );
    const query4 = await selfQueryRetriever.getRelevantDocuments(
      "Which movies are either comedy or drama and are less than 90 minutes?"
    );
    const query5 = await selfQueryRetriever.getRelevantDocuments(
      "Awawawawa hello hello hello huh where am i?"
    );
    console.log(query1, query2, query3, query4, query5); // query 5 should return documents
    expect(query5.length).toBeGreaterThan(0);
  });
});
