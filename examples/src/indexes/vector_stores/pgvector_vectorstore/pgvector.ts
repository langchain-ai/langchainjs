import { OpenAIEmbeddings } from "@langchain/openai";
import {
  DistanceStrategy,
  PGVectorStore,
} from "@langchain/community/vectorstores/pgvector";
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
  // supported distance strategies: cosine (default), innerProduct, or euclidean
  distanceStrategy: "cosine" as DistanceStrategy,
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

// Filtering is supported
const results2 = await pgvectorStore.similaritySearch("water", 1, {
  a: 2,
});

console.log(results2);

/*
  [ Document { pageContent: 'what's this', metadata: { a: 2 } } ]
*/

// Filtering on multiple values using "in" is supported too
const results3 = await pgvectorStore.similaritySearch("water", 1, {
  a: {
    in: [2],
  },
});

console.log(results3);

/*
  [ Document { pageContent: 'what's this', metadata: { a: 2 } } ]
*/

await pgvectorStore.delete({
  filter: {
    a: 1,
  },
});

const results4 = await pgvectorStore.similaritySearch("water", 1);

console.log(results4);

/*
  [ Document { pageContent: 'what's this', metadata: { a: 2 } } ]
*/

await pgvectorStore.end();
