import { createClient, RedisClientType } from "redis";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RedisVectorStore } from "langchain/vectorstores/redis";

export const run = async () => {
  const redisClient = createClient({
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  });
  await redisClient.connect();

  const texts = ["Hello world", "Bye bye", "hello nice world"];
  const metadatas = [{ id: 2 }, { id: 1 }, { id: 3 }];
  const vectorStore = await RedisVectorStore.fromTexts(
    texts,
    metadatas,
    new OpenAIEmbeddings(),
    {
      redisClient: redisClient as RedisClientType,
      indexName: "documents",
    }
  );

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  console.log(resultOne);

  await redisClient.disconnect();
};
