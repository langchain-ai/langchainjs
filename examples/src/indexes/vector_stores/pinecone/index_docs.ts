/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Pinecone } from "@pinecone-database/pinecone";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
// import { Index } from "@upstash/vector";

// Instantiate a new Pinecone client, which will automatically read the
// env vars: PINECONE_API_KEY which comes from
// the Pinecone dashboard at https://app.pinecone.io

const pinecone = new Pinecone();

// If index already exists:
// const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

// If index does not exist, create it:
await pinecone.createIndex({
  name: process.env.PINECONE_INDEX!,
  dimension: 1536,
  metric: "cosine",
  spec: {
    serverless: {
      cloud: "aws",
      region: "us-east-1",
    },
  },
  deletionProtection: "disabled", // Note: deletion protection disabled https://docs.pinecone.io/guides/indexes/prevent-index-deletion#disable-deletion-protection
});

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

const docs = [
  new Document({
    metadata: { foo: "bar" },
    pageContent: "pinecone is a vector db",
  }),
  new Document({
    metadata: { foo: "bar" },
    pageContent: "the quick brown fox jumped over the lazy dog",
  }),
  new Document({
    metadata: { baz: "qux" },
    pageContent: "lorem ipsum dolor sit amet",
  }),
  new Document({
    metadata: { baz: "qux" },
    pageContent: "pinecones are the woody fruiting body and of a pine tree",
  }),
];

await PineconeStore.fromDocuments(docs, new OpenAIEmbeddings(), {
  pineconeIndex,
  maxConcurrency: 5, // Maximum number of batch requests to allow at once. Each batch is 1000 vectors.
});
