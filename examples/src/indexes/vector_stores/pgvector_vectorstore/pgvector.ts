import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PGVectorStore } from "langchain/vectorstores/pgvector";
import { PoolConfig } from "pg";

// First, follow set-up instructions at
// https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/pgvector

const config = {
  postgresConnectionOptions: {
    type: "postgres",
    host: "127.0.0.1",
    port: 5433,
    user: "myuser",
    password: "ChangeMe",
    database: "api",
  } as PoolConfig,
  tableName: "testlangchain",
  columns: {
    idColumnName: "id",
    vectorColumnName: "vector",
    contentColumnName: "content",
    metadataColumnName: "metadata",
  },
};

const pgvectorStore = await PGVectorStore.initialize(
  new OpenAIEmbeddings(),
  config
);

await pgvectorStore.addDocuments([
  { pageContent: "what's this", metadata: { a: 2 } },
  { pageContent: "Cat drinks milk", metadata: { a: 1 } },
]);

const results = await pgvectorStore.similaritySearch("water", 1);

console.log(results);

/*
  [ Document { pageContent: 'Cat drinks milk', metadata: { a: 1 } } ]
*/

await pgvectorStore.delete({
  filter: {
    a: 1,
  },
});

const results2 = await pgvectorStore.similaritySearch("water", 1);

console.log(results2);

/*
  [ Document { pageContent: 'what's this', metadata: { a: 2 } } ]
*/

await pgvectorStore.end();
