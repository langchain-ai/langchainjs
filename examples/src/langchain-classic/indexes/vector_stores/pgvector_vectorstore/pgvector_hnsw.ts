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

// create the index
await pgvectorStore.createHnswIndex({
  dimensions: 1536,
  efConstruction: 64,
  m: 16,
});

await pgvectorStore.addDocuments([
  { pageContent: "what's this", metadata: { a: 2, b: ["tag1", "tag2"] } },
  { pageContent: "Cat drinks milk", metadata: { a: 1, b: ["tag2"] } },
]);

const model = new OpenAIEmbeddings();
const query = await model.embedQuery("water");
const results = await pgvectorStore.similaritySearchVectorWithScore(query, 1);

console.log(results);

await pgvectorStore.end();
