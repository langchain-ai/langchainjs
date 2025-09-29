import { Index } from "@upstash/vector";
import { OpenAIEmbeddings } from "@langchain/openai";
import { UpstashVectorStore } from "@langchain/community/vectorstores/upstash";

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL as string,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN as string,
});

const embeddings = new OpenAIEmbeddings({});

const UpstashVector = new UpstashVectorStore(embeddings, { index });

// Creating the docs to be indexed.
const createdAt = new Date().getTime();

const IDs = await UpstashVector.addDocuments([
  { pageContent: "hello", metadata: { a: createdAt + 1 } },
  { pageContent: "car", metadata: { a: createdAt } },
  { pageContent: "adjective", metadata: { a: createdAt } },
  { pageContent: "hi", metadata: { a: createdAt } },
]);

// Waiting vectors to be indexed in the vector store.
// eslint-disable-next-line no-promise-executor-return
await new Promise((resolve) => setTimeout(resolve, 1000));

await UpstashVector.delete({ ids: [IDs[0], IDs[2], IDs[3]] });
