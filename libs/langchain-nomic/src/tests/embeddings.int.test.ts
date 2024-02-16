/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
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

test("NomicEmbeddings can embed query", async () => {
  const nomicEmbeddings = new NomicEmbeddings();
  const query = "hello world";
  const embeddings = await nomicEmbeddings.embedQuery(query);
  expect(embeddings).toHaveLength(768);
});

test("NomicEmbeddings can embed with non-default model", async () => {
  const nomicEmbeddings = new NomicEmbeddings({
    modelName: "nomic-embed-text-v1.5",
  });
  const query = "hello world";
  const embeddings = await nomicEmbeddings.embedQuery(query);
  // Different num of dimensions from default model
  expect(embeddings).toHaveLength(768);
});

test("NomicEmbeddings can embed with non-default num of dimensions", async () => {
  const nomicEmbeddings = new NomicEmbeddings({
    modelName: "nomic-embed-text-v1.5",
    dimensionality: 256,
  });
  const query = "hello world";
  const embeddings = await nomicEmbeddings.embedQuery(query);
  // Different num of dimensions from default model
  expect(embeddings).toHaveLength(256);
});