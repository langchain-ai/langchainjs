import { OpenAIEmbeddings } from "@langchain/openai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import pg from "pg";

// First, follow set-up instructions at
// https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/pgvector

const reusablePool = new pg.Pool({
  host: "127.0.0.1",
  port: 5433,
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
    vectorColumnName: "vector",
    contentColumnName: "content",
    metadataColumnName: "metadata",
  },
};

// Set up the DB.
// Can skip this step if you've already initialized the DB.
// await PGVectorStore.initialize(new OpenAIEmbeddings(), originalConfig);

const pgvectorStore = new PGVectorStore(new OpenAIEmbeddings(), originalConfig);

await pgvectorStore.addDocuments([
  { pageContent: "what's this", metadata: { a: 2 } },
  { pageContent: "Cat drinks milk", metadata: { a: 1 } },
]);

const results = await pgvectorStore.similaritySearch("water", 1);

console.log(results);

/*
  [ Document { pageContent: 'Cat drinks milk', metadata: { a: 1 } } ]
*/

const pgvectorStore2 = new PGVectorStore(new OpenAIEmbeddings(), {
  pool: reusablePool,
  tableName: "testlangchain",
  collectionTableName: "collections",
  collectionName: "some_other_collection",
  columns: {
    idColumnName: "id",
    vectorColumnName: "vector",
    contentColumnName: "content",
    metadataColumnName: "metadata",
  },
});

const results2 = await pgvectorStore2.similaritySearch("water", 1);

console.log(results2);

/*
  []
*/

await reusablePool.end();
