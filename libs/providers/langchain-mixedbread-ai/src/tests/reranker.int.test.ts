import { test, expect } from "vitest";
import { Document } from "@langchain/core/documents";
import { MixedbreadAIReranker } from "../reranker.js";

const query = "What is the capital of France?";

const documents = [
  new Document({
    pageContent:
      "Bread is a staple food prepared from a dough of flour and water",
  }),
  new Document({
    pageContent:
      "There are many types of bread, such as baguette, focaccia, and sourdough, and they are all delicious.",
  }),
  new Document({
    pageContent:
      "And it is usually baked, such as the models from mixedbread ai",
  }),
];

test("MixedbreadAIReranker can indeed rerank documents with compressDocuments method", async () => {
  const mxbaiReranker = new MixedbreadAIReranker();

  const rerankedDocuments = await mxbaiReranker.compressDocuments(
    documents,
    query
  );
  // console.log(rerankedDocuments);
  expect(rerankedDocuments).toHaveLength(3);
});

test("MixedbreadAIReranker can indeed rerank documents with rerank method", async () => {
  const mxbaiReranker = new MixedbreadAIReranker();

  const rerankedDocuments = await mxbaiReranker.rerank(
    documents.map((doc) => doc.pageContent),
    query
  );
  // console.log(rerankedDocuments);
  expect(rerankedDocuments).toHaveLength(3);
});
