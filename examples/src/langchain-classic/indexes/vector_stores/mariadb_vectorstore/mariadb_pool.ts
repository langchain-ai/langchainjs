import { OpenAIEmbeddings } from "@langchain/openai";
import { MariaDBStore } from "@langchain/community/vectorstores/mariadb";
import mariadb from "mariadb";

// First, follow set-up instructions at
// https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/mariadb

const reusablePool = mariadb.createPool({
  host: "127.0.0.1",
  port: 3306,
  user: "myuser",
  password: "ChangeMe",
  database: "api",
});

const originalConfig = {
  pool: reusablePool,
  tableName: "testlangchain",
  collectionName: "sample",
  collectionTableName: "collections",
  columns: {
    idColumnName: "id",
    vectorColumnName: "vect",
    contentColumnName: "content",
    metadataColumnName: "metadata",
  },
};

// Set up the DB.
// Can skip this step if you've already initialized the DB.
const vectorStore = await MariaDBStore.initialize(
  new OpenAIEmbeddings(),
  originalConfig
);
// const vectorStore = new MariaDBStore(new OpenAIEmbeddings(), originalConfig);

await vectorStore.addDocuments([
  { pageContent: "what's this", metadata: { a: 2 } },
  { pageContent: "Cat drinks milk", metadata: { a: 1 } },
]);

const results = await vectorStore.similaritySearch("water", 1);

console.log(results);
// [ Document { pageContent: 'Cat drinks milk', metadata: { a: 1 }, id: ... } ]

const vectorStore2 = new MariaDBStore(new OpenAIEmbeddings(), {
  pool: reusablePool,
  tableName: "testlangchain",
  collectionTableName: "collections",
  collectionName: "some_other_collection",
  columns: {
    idColumnName: "id",
    vectorColumnName: "vect",
    contentColumnName: "content",
    metadataColumnName: "metadata",
  },
});

const results2 = await vectorStore2.similaritySearch("water", 1);

console.log(results2);
// []

await reusablePool.end();
