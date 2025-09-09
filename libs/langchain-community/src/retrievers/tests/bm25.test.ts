import { expect, test } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { BM25Retriever } from "../bm25.js";
import { getTermFrequency } from "../../utils/@furkantoprak/bm25/BM25.js";

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

test("getTermFrequency escapes regex metacharacters", () => {
  const corpus =
    "**Version 1:** What is the country of origin for the person in question?";
  const term = "**Version 1:**";

  // Should not throw and should find at least one match
  const freq = getTermFrequency(term, corpus);
  expect(freq).toBeGreaterThanOrEqual(1);

  // Also test other metacharacters
  const corpus2 = "Does this match (maybe)? [yes] *stars* +plus+";
  expect(getTermFrequency("(maybe)?", corpus2)).toBeGreaterThanOrEqual(1);
  expect(getTermFrequency("[yes]", corpus2)).toBeGreaterThanOrEqual(1);
  expect(getTermFrequency("*stars*", corpus2)).toBeGreaterThanOrEqual(1);
  expect(getTermFrequency("+plus+", corpus2)).toBeGreaterThanOrEqual(1);
});
