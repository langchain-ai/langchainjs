import { Index } from "@upstash/vector";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { UpstashVectorStore } from "@langchain/community/vectorstores/upstash";

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL as string,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN as string,
});

const embeddings = new OpenAIEmbeddings({});

const UpstashVector = new UpstashVectorStore(embeddings, { index });

// Creating the docs to be indexed.
const id = new Date().getTime();
const documents = [
  new Document({
    metadata: { name: id },
    pageContent: "Hello there!",
  }),
  new Document({
    metadata: { name: id },
    pageContent: "What are you building?",
  }),
  new Document({
    metadata: { time: id },
    pageContent: "Upstash Vector is great for building AI applications.",
  }),
  new Document({
    metadata: { time: id },
    pageContent: "To be, or not to be, that is the question.",
  }),
];

// Creating embeddings from the provided documents, and adding them to Upstash database.
await UpstashVector.addDocuments(documents);

// Waiting vectors to be indexed in the vector store.
// eslint-disable-next-line no-promise-executor-return
await new Promise((resolve) => setTimeout(resolve, 1000));

const queryResult = await UpstashVector.similaritySearchWithScore(
  "Vector database",
  2
);

console.log(queryResult);
/**
[
  [
    Document {
      pageContent: 'Upstash Vector is great for building AI applications.',
      metadata: [Object]
    },
    0.9016147
  ],
  [
    Document {
      pageContent: 'What are you building?',
      metadata: [Object]
    },
    0.8613077
  ]
]
 */
