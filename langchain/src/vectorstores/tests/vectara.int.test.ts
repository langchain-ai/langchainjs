/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { VectaraStore } from "../vectara.js";
import { Document } from "../../document.js";

const hashCode = (s: string) => {
  return s.split("").reduce((a, b) => {
    a = ((a << 5) - a + b.charCodeAt(0)) | 0;
    return a;
  }, 0);
};

test.skip("Vectara Add Documents", async () => {
  const store = new VectaraStore({
    customer_id: Number(process.env.VECTARA_CUSTOMER_ID) || 0,
    corpus_id: Number(process.env.VECTARA_CORPUS_ID) || 0,
    api_key: process.env.VECTARA_API_KEY || ""
  });

  // Some text from Lord of the Rings
  const firstText = "It all depends on what you want. You can trust us to stick to you through thick and thin to the bitter end. And you can trust us to keep any secret of yours – closer than you keep it yourself. But you cannot trust us to let you face trouble alone, and go off without a word. We are your friends, Frodo. Anyway: there it is. We know most of what Gandalf has told you. We know a good deal about the Ring. We are horribly afraid – but we are coming with you; or following you like hounds.";
  const secondText = "Sam lay back, and stared with open mouth, and for a moment, between bewilderment and great joy, he could not answer. At last he gasped: “Gandalf! I thought you were dead! But then I thought I was dead myself. Is everything sad going to come untrue? What’s happened to the world?";

  const documents = [
    new Document({
      pageContent: firstText,
      metadata: {
        document_id: hashCode(firstText).toString(), // Generate a hashcode for document id based on the text
        title: "Lord of the Rings",
        author: "Tokien",
        genre: "fiction"
      },
    }),
    new Document({
      pageContent: secondText,
      metadata: {
        document_id: hashCode(secondText).toString(), // Generate a hashcode for document id based on the text
        title: "Lord of the Rings",
        author: "Tolkien",
        genre: "fiction"
      },
    })
  ];

  const indexResult = await store.addDocuments(documents);
  expect(indexResult.code).toEqual(200);

  const resultsWithScore = await store.similaritySearchWithScore("What did Sam do?", 1);
  expect(resultsWithScore.length).toBeGreaterThan(0);
  expect(resultsWithScore[0][0].pageContent.length).toBeGreaterThan(0);
  expect(resultsWithScore[0][0].metadata.length).toBeGreaterThan(0);

  const results = await store.similaritySearch("Was Gandalf dead?", 1);
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].pageContent.length).toBeGreaterThan(0);
  expect(results[0].metadata.length).toBeGreaterThan(0);

});
