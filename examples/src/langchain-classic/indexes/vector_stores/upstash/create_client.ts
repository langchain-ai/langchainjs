import { Index } from "@upstash/vector";
import { OpenAIEmbeddings } from "@langchain/openai";
import { UpstashVectorStore } from "@langchain/community/vectorstores/upstash";

const embeddings = new OpenAIEmbeddings({});

// Creating the index with the provided credentials.
const indexWithCredentials = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL as string,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN as string,
});

const storeWithCredentials = new UpstashVectorStore(embeddings, {
  index: indexWithCredentials,
});

// Creating the index from the environment variables automatically.
const indexFromEnv = new Index();

const storeFromEnv = new UpstashVectorStore(embeddings, {
  index: indexFromEnv,
});
