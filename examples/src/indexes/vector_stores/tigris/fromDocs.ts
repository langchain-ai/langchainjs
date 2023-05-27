import { VectorDocumentStore } from "@tigrisdata/vector";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { TigrisVectorStore } from "langchain/vectorstores/tigris";

const index = new VectorDocumentStore({
  connection: {
    serverUrl: "api.preview.tigrisdata.cloud",
    projectName: process.env.TIGRIS_PROJECT,
    clientId: process.env.TIGRIS_CLIENT_ID,
    clientSecret: process.env.TIGRIS_CLIENT_SECRET,
  },
  indexName: "examples_index",
  numDimensions: 1536, // match the OpenAI embedding size
});

const docs = [
  new Document({
    metadata: { foo: "bar" },
    pageContent: "tigris is a cloud-native vector db",
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
    pageContent: "tigris is a river",
  }),
];

await TigrisVectorStore.fromDocuments(docs, new OpenAIEmbeddings(), { index });
