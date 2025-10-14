import { test, expect } from "vitest";
import { NomicEmbeddings } from "../embeddings.js";

test("NomicEmbeddings can embed docs", async () => {
  const nomicEmbeddings = new NomicEmbeddings();
  const docs = [
    "hello world",
    "nomic embeddings!",
    "super special langchain integration package",
    "what color is the sky?",
  ];

  const embeddings = await nomicEmbeddings.embedDocuments(docs);
  expect(embeddings).toHaveLength(4);
  expect(embeddings[0]).toHaveLength(768);
});

test("NomicEmbeddings can embed more docs than the default batch size", async () => {
  const nomicEmbeddings = new NomicEmbeddings({
    maxRetries: 0,
  });
  // Batch size is 400. 800 docs should be 2 batches.
  const docs = Array.from({ length: 800 }, () => "hello world");

  const embeddings = await nomicEmbeddings.embedDocuments(docs);
  expect(embeddings).toHaveLength(800);
  expect(embeddings[0]).toHaveLength(768);
});

test("NomicEmbeddings can embed query", async () => {
  const nomicEmbeddings = new NomicEmbeddings();
  const query = "hello world";
  const embeddings = await nomicEmbeddings.embedQuery(query);
  expect(embeddings).toHaveLength(768);
});

test("NomicEmbeddings can embed with non-default model", async () => {
  const nomicEmbeddings = new NomicEmbeddings({
    model: "nomic-embed-text-v1.5",
  });
  const query = "hello world";
  const embeddings = await nomicEmbeddings.embedQuery(query);
  expect(embeddings).toHaveLength(768);
});

test("NomicEmbeddings can embed with non-default num of dimensions", async () => {
  const nomicEmbeddings = new NomicEmbeddings({
    model: "nomic-embed-text-v1.5",
    dimensionality: 256,
  });
  const query = "hello world";
  const embeddings = await nomicEmbeddings.embedQuery(query);
  // Different num of dimensions from default
  expect(embeddings).toHaveLength(256);
});
