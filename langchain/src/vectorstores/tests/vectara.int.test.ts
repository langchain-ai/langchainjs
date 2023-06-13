/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { VectaraStore } from "../vectara.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { Document } from "../../document.js";
import { v4 } from "uuid";

test("Vectara Add Documents", async () => {
  const store = new VectaraStore(new OpenAIEmbeddings(), {
    customer_id: Number(process.env.VECTARA_CUSTOMER_ID) || 0,
    corpus_id: Number(process.env.VECTARA_CORPUS_ID) || 0,
    api_key: process.env.VECTARA_API_KEY || ""
  }
  );

  const documents = [
    new Document({
      pageContent: "This is a sample text from langchain unit test",
      metadata: {
        document_id: v4(), // Generate a random document id
        title: "First Title",
        author: "Judd Trump",
        genre: "fiction"
      },
    }),
    new Document({
      pageContent: "This is some more text from langchain unit test",
      metadata: {
        document_id: v4(), // Generate a random document id
        title: "Second Title",
        author: "Ronnie O'Sullivan",
        genre: "snooker"
      },
    })
  ];

  const indexResult = await store.addDocuments(documents);
  const { code, detail } = indexResult;
  expect(code).toEqual(200);
  expect(detail).toEqual(`Successfully added ${documents.length} documents to Vectara`);

  const resultsWithScore = await store.similaritySearchWithScore("test", 1);
  expect(resultsWithScore.length).toBeGreaterThan(0);
  expect(resultsWithScore[0][0].pageContent.length).toBeGreaterThan(0);
  expect(resultsWithScore[0][0].metadata.length).toBeGreaterThan(0);

  const results = await store.similaritySearch("test", 1);
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].pageContent.length).toBeGreaterThan(0);
  expect(results[0].metadata.length).toBeGreaterThan(0);

});
