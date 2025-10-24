import { createClient } from "redis";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RedisVectorStore } from "@langchain/redis";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";

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
const model = new ChatOpenAI({ model: "gpt-3.5-turbo-1106" });
const questionAnsweringPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "Answer the user's questions based on the below context:\n\n{context}",
  ],
  ["human", "{input}"],
]);

const combineDocsChain = await createStuffDocumentsChain({
  llm: model,
  prompt: questionAnsweringPrompt,
});

const chain = await createRetrievalChain({
  retriever: vectorStore.asRetriever(),
  combineDocsChain,
});

const chainRes = await chain.invoke({ input: "What did the fox do?" });
console.log(chainRes);
/*
  {
    input: 'What did the fox do?',
    chat_history: [],
    context: [
      Document {
        pageContent: 'the quick brown fox jumped over the lazy dog',
        metadata: [Object]
      },
      Document {
        pageContent: 'lorem ipsum dolor sit amet',
        metadata: [Object]
      },
      Document {
        pageContent: 'consectetur adipiscing elit',
        metadata: [Object]
      },
      Document { pageContent: 'redis is fast', metadata: [Object] }
    ],
    answer: 'The fox jumped over the lazy dog.'
  }
*/

await client.disconnect();
