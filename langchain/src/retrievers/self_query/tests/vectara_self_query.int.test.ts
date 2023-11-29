/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { Document } from "../../../document.js";
import { AttributeInfo } from "../../../schema/query_constructor.js";
import { SelfQueryRetriever } from "../index.js";
import { OpenAI } from "../../../llms/openai.js";
import { VectaraTranslator } from "../vectara.js";
import { FakeEmbeddings } from "../../../embeddings/fake.js";
import { VectaraStore } from "../../../vectorstores/vectara.js";

test.skip("Vectara Self Query Retriever Test", async () => {
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
        rating: 9.9,
        director: "Andrei Tarkovsky",
        genre: "science fiction",
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
  ];
  const config = {
    customerId: Number(process.env.VECTARA_CUSTOMER_ID),
    corpusId: Number(process.env.VECTARA_CORPUS_ID),
    apiKey: String(process.env.VECTARA_API_KEY),
    verbose: true,
  };

  const vectorStore = await VectaraStore.fromDocuments(
    docs,
    new FakeEmbeddings(),
    config
  );

  const llm = new OpenAI();
  const documentContents = "Brief summary of a movie";

  const selfQueryRetriever = await SelfQueryRetriever.fromLLM({
    llm,
    vectorStore,
    documentContents,
    attributeInfo,

    structuredQueryTranslator: new VectaraTranslator(),
  });

  const query1 = await selfQueryRetriever.getRelevantDocuments(
    "I want to watch a movie rated higher than 8.5"
  );
  const query2 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are directed by Greta Gerwig?"
  );
  const query3 = await selfQueryRetriever.getRelevantDocuments(
    "Which movies are either comedy or science fiction and are rated higher than 8.5?"
  );
  const query4 = await selfQueryRetriever.getRelevantDocuments(
    "Wau wau wau wau hello gello hello?"
  );
  console.log(query1, query2, query3, query4);
  expect(query1.length).toBe(2);
  expect(query2.length).toBe(1);
  expect(query3.length).toBe(1);
  expect(query4.length).toBe(0);
});
