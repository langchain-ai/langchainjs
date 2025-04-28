import { expect, test } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { BM25Retriever } from "../bm25.js";

test("BM25Retriever", async () => {
  const docs = [
    new Document({
      pageContent: "The quick brown fox jumps over the lazy dog",
    }),
    new Document({
      pageContent: "A lazy dog sleeps all day",
    }),
    new Document({
      pageContent: "The brown fox is quick and clever",
    }),
  ];

  const retriever = BM25Retriever.fromDocuments(docs, {
    k: 2,
  });
  const results = await retriever.invoke("the fox and the dog");

  expect(results).toHaveLength(2);
  expect(results[0].pageContent).toBe(
    "The quick brown fox jumps over the lazy dog"
  );
});
