/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Pinecone } from "@pinecone-database/pinecone";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";

// Instantiate a new Pinecone client, which will automatically read the
// env vars: PINECONE_API_KEY which comes from
// the Pinecone dashboard at https://app.pinecone.io

const pinecone = new Pinecone();

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);
const embeddings = new OpenAIEmbeddings();
const pineconeStore = new PineconeStore(embeddings, { pineconeIndex });

const docs = [
  new Document({
    metadata: { foo: "bar" },
    pageContent: "pinecone is a vector db",
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
    pageContent: "pinecones are the woody fruiting body and of a pine tree",
  }),
];

const pageContent = "some arbitrary content";

// Also takes an additional {ids: []} parameter for upsertion
const ids = await pineconeStore.addDocuments(docs);

const results = await pineconeStore.similaritySearch(pageContent, 2, {
  foo: "bar",
});

console.log(results);
/*
[
  Document {
    pageContent: 'pinecone is a vector db',
    metadata: { foo: 'bar' },
  },
  Document {
    pageContent: "the quick brown fox jumped over the lazy dog",
    metadata: { foo: "bar" },
  }
]
*/

await pineconeStore.delete({
  ids: [ids[0], ids[1]],
});

const results2 = await pineconeStore.similaritySearch(pageContent, 2, {
  foo: "bar",
});

console.log(results2);
/*
  []
*/
