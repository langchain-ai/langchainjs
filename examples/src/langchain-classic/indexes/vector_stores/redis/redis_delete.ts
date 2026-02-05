import { createClient } from "redis";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RedisVectorStore } from "@langchain/redis";
import { Document } from "@langchain/core/documents";

const client = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});
await client.connect();

const docs = [
  new Document({
    metadata: { foo: "bar" },
    pageContent: "redis is fast",
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
    pageContent: "consectetur adipiscing elit",
  }),
];

const vectorStore = await RedisVectorStore.fromDocuments(
  docs,
  new OpenAIEmbeddings(),
  {
    redisClient: client,
    indexName: "docs",
  }
);

await vectorStore.delete({ deleteAll: true });

await client.disconnect();
