/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";

// Instantiate a new Pinecone client, which will automatically read the
// env vars: PINECONE_API_KEY and PINECONE_ENVIRONMENT which come from
// the Pinecone dashboard at https://app.pinecone.io

const pinecone = new Pinecone();

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

const vectorStore = await PineconeStore.fromExistingIndex(
  new OpenAIEmbeddings(),
  { pineconeIndex }
);

/* Search the vector DB independently with meta filters */
const results = await vectorStore.maxMarginalRelevanceSearch("pinecone", {
  k: 5,
  fetchK: 20, // Default value for the number of initial documents to fetch for reranking.
  // You can pass a filter as well
  // filter: {},
});
console.log(results);
