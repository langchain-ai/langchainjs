import { Index } from "@upstash/vector";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { UpstashVectorStore } from "@langchain/community/vectorstores/upstash";

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL as string,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN as string,
});

const embeddings = new OpenAIEmbeddings({});

const UpstashVector = new UpstashVectorStore(embeddings, {
  index,
  namespace: "test-namespace",
});

// Creating the docs to be indexed.
const id = new Date().getTime();
const documents = [
  new Document({
    metadata: { name: id },
    pageContent: "Vector databases are great!",
  }),
];

// Creating embeddings from the provided documents, and adding them to target namespace in Upstash Vector database.
await UpstashVector.addDocuments(documents);

// Waiting vectors to be indexed in the vector store.
// eslint-disable-next-line no-promise-executor-return
await new Promise((resolve) => setTimeout(resolve, 1000));

const queryResult = await UpstashVector.similaritySearchWithScore(
  "Vector database",
  1
);

console.log(queryResult);
/**
[
  [
	Document {
	  pageContent: 'Vector databases are great!',
	  metadata: [Object]
	},
	0.9016147
  ],
]
 */
