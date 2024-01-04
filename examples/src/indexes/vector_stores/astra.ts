import { OpenAIEmbeddings } from "@langchain/openai";
import {
  AstraDBVectorStore,
  AstraLibArgs,
} from "@langchain/community/vectorstores/astradb";

const astraConfig: AstraLibArgs = {
  token: process.env.ASTRA_DB_APPLICATION_TOKEN as string,
  endpoint: process.env.ASTRA_DB_ENDPOINT as string,
  collection: process.env.ASTRA_DB_COLLECTION ?? "langchain_test",
  collectionOptions: {
    vector: {
      dimension: 1536,
      metric: "cosine",
    },
  },
};

const vectorStore = await AstraDBVectorStore.fromTexts(
  [
    "AstraDB is built on Apache Cassandra",
    "AstraDB is a NoSQL DB",
    "AstraDB supports vector search",
  ],
  [{ foo: "foo" }, { foo: "bar" }, { foo: "baz" }],
  new OpenAIEmbeddings(),
  astraConfig
);

// Querying docs:
const results = await vectorStore.similaritySearch("Cassandra", 1);

// or filtered query:
const filteredQueryResults = await vectorStore.similaritySearch("A", 1, {
  foo: "bar",
});
