/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import rockset from "@rockset/client";
import { test, expect } from "@jest/globals";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { RocksetStore, SimilarityMetric } from "../rockset.js";

const getPageContents = (documents: Document[]) =>
  documents.map((document) => document.pageContent);

const embeddings = new OpenAIEmbeddings();
let store: RocksetStore | undefined;

const docs = [
  new Document({
    pageContent: "Tomatoes are red.",
    metadata: { subject: "tomatoes" },
  }),
  new Document({
    pageContent: "Tomatoes are small.",
    metadata: { subject: "tomatoes" },
  }),
  new Document({
    pageContent: "Apples are juicy.",
    metadata: { subject: "apples" },
  }),
];

test.skip("create new collection as a RocksetVectorStore", async () => {
  store = await RocksetStore.withNewCollection(embeddings, {
    collectionName: "langchain_demo",
    client: rockset.default(
      process.env.ROCKSET_API_KEY ?? "",
      `https://api.${process.env.ROCKSET_API_REGION ?? "usw2a1"}.rockset.com`
    ),
  });
});

test.skip("add to RocksetVectorStore", async () => {
  expect(store).toBeDefined();
  expect((await store!.addDocuments(docs))?.length).toBe(docs.length);
});

test.skip("query RocksetVectorStore with cosine sim", async () => {
  expect(store).toBeDefined();
  const relevantDocs = await store!.similaritySearch(
    "What color are tomatoes?"
  );
  expect(getPageContents(relevantDocs)).toEqual(getPageContents(relevantDocs));
});

test.skip("query RocksetVectorStore with dot product", async () => {
  expect(store).toBeDefined();
  store!.similarityMetric = SimilarityMetric.DotProduct;
  const relevantDocs = await store!.similaritySearch(
    "What color are tomatoes?"
  );
  expect(getPageContents(relevantDocs)).toEqual(getPageContents(relevantDocs));
});

test.skip("query RocksetVectorStore with euclidean distance", async () => {
  expect(store).toBeDefined();
  store!.similarityMetric = SimilarityMetric.EuclideanDistance;
  const relevantDocs = await store!.similaritySearch(
    "What color are tomatoes?"
  );
  expect(getPageContents(relevantDocs)).toEqual(getPageContents(relevantDocs));
});

test.skip("query RocksetVectorStore with metadata filter", async () => {
  expect(store).toBeDefined();
  const relevantDocs = await store!.similaritySearch(
    "What color are tomatoes?",
    undefined,
    "subject='apples'"
  );
  expect(relevantDocs.length).toBe(1);
  expect(getPageContents(relevantDocs)).toEqual(getPageContents([docs[2]]));
});

test.skip("query RocksetVectorStore with k", async () => {
  expect(store).toBeDefined();
  const relevantDocs = await store!.similaritySearch(
    "What color are tomatoes?",
    1
  );
  expect(relevantDocs.length).toBe(1);
});
