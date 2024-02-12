/* eslint-disable no-process-env */
import { Document } from "@langchain/core/documents";
import { CohereRerank } from "../rerank.js";

test("CohereRerank can indeed rerank documents!", async () => {
  const query = "What is the capital of France?";

  const documents = [
    new Document({
      pageContent: "Paris is the capital of France.",
    }),
    new Document({
      pageContent: "Build context-aware reasoning applications",
    }),
    new Document({
      pageContent:
        "Carson City is the capital city of the American state of Nevada. At the  2010 United States Census, Carson City had a population of 55,274",
    }),
  ];

  const cohereRerank = new CohereRerank({
    apiKey: process.env.COHERE_API_KEY,
  });

  const rerankedDocuments = await cohereRerank.compressDocuments(
    documents,
    query
  );
  console.log(rerankedDocuments);
  expect(rerankedDocuments).toHaveLength(3);
});
