/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import { PineconeClient } from "@pinecone-database/pinecone";
import { BertTokenizer } from "bert-tokenizer";

import { OpenAIEmbeddings } from "../../embeddings/index.js";
import { PineconeHybridSearchRetriever } from "../pinecone-hybrid-search.js";

test("Pinecone hybrid search", async () => {
  const client = new PineconeClient();

  await client.init({
    environment: process.env.PINECONE_ENVIRONMENT!,
    apiKey: process.env.PINECONE_API_KEY!,
  });

  const embeddings = new OpenAIEmbeddings();
  const pineconeIndex = client.Index(process.env.PINECONE_INDEX!);

  const tokenizer = new BertTokenizer(undefined, true, 512);

  const retriever = new PineconeHybridSearchRetriever(embeddings, {
    pineconeIndex,
    topK: 3,
    alpha: 0.5,
    tokenizer,
  });

  expect(retriever).toBeDefined();

  const results = await retriever.getRelevantDocuments("hello bye");

  expect(results.length).toBeGreaterThan(0);
});
