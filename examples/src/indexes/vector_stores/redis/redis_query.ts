import { createClient } from "redis";
import { OpenAI } from "langchain/llms/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RetrievalQAChain } from "langchain/chains";
import { RedisVectorStore } from "langchain/vectorstores/redis";

const client = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});
await client.connect();

const vectorStore = new RedisVectorStore(new OpenAIEmbeddings(), {
  redisClient: client,
  indexName: "docs",
});

/* Simple standalone search in the vector DB */
const simpleRes = await vectorStore.similaritySearch("redis", 1);
console.log(simpleRes);
/*
[
  Document {
    pageContent: "redis is fast",
    metadata: { foo: "bar" }
  }
]
*/

/* Search in the vector DB using filters */
const filterRes = await vectorStore.similaritySearch("redis", 3, ["qux"]);
console.log(filterRes);
/*
[
  Document {
    pageContent: "consectetur adipiscing elit",
    metadata: { baz: "qux" },
  },
  Document {
    pageContent: "lorem ipsum dolor sit amet",
    metadata: { baz: "qux" },
  }
]
*/

/* Usage as part of a chain */
const model = new OpenAI();
const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever(1), {
  returnSourceDocuments: true,
});
const chainRes = await chain.call({ query: "What did the fox do?" });
console.log(chainRes);
/*
{
  text: " The fox jumped over the lazy dog.",
  sourceDocuments: [
    Document {
      pageContent: "the quick brown fox jumped over the lazy dog",
      metadata: [Object]
    }
  ]
}
*/

await client.disconnect();
