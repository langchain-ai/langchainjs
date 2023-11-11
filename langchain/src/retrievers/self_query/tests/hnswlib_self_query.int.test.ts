import { test } from "@jest/globals";
import { Document } from "../../../document.js";
import { AttributeInfo } from "../../../schema/query_constructor.js";
import { OpenAIEmbeddings } from "../../../embeddings/openai.js";
import { SelfQueryRetriever } from "../index.js";
import { OpenAI } from "../../../llms/openai.js";
import { FunctionalTranslator } from "../functional.js";
import { HNSWLib } from "../../../vectorstores/hnswlib.js";

test("HNSWLib Store Self Query Retriever Test", async () => {
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
    temperature: 0.01,
  });
  const documentContents = "Brief summary of a movie";
  const vectorStore = await HNSWLib.fromDocuments(docs, embeddings);
  const selfQueryRetriever = await SelfQueryRetriever.fromLLM({
    llm,
    vectorStore,
    documentContents,
    attributeInfo,
    structuredQueryTranslator: new FunctionalTranslator(),
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
});

test("HNSWLib shouldn't throw an error if a filter can't be generated, but should return no items", async () => {
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

  const attributeInfo = [
    {
      name: "sectionNumber",
      description: "The section number of the rule",
      type: "number",
    },
    {
      name: "sectionTitle",
      description: "The section title of the rule",
      type: "string",
    },
    {
      name: "sectionScope",
      description: "The section scope of the rule",
      type: "string",
    },
    {
      name: "codeRule",
      description: "The code rule of the rule",
      type: "string",
    },
  ];

  const embeddings = new OpenAIEmbeddings();
  const llm = new OpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.01,
  });
  const documentContents = "Brief summary of a movie";
  const vectorStore = await HNSWLib.fromDocuments(docs, embeddings);
  const selfQueryRetriever = await SelfQueryRetriever.fromLLM({
    llm,
    vectorStore,
    documentContents,
    attributeInfo,
    structuredQueryTranslator: new FunctionalTranslator(),
  });

  const query1 = await selfQueryRetriever.getRelevantDocuments(
    "Which sectionTitle talks about pools?"
  );
  console.log(query1);
  expect(query1.length).toEqual(0);
});
