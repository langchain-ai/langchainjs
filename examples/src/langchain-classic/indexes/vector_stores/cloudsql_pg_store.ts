import {
  Column,
  PostgresEngine,
  PostgresEngineArgs,
  PostgresVectorStore,
  PostgresVectorStoreArgs,
  VectorStoreTableArgs,
} from "@langchain/google-cloud-sql-pg";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";
import type { Document } from "@langchain/core/documents";
import { v4 as uuidv4 } from "uuid";
import * as dotenv from "dotenv";

dotenv.config();

const peArgs: PostgresEngineArgs = {
  user: process.env.DB_USER ?? "",
  password: process.env.PASSWORD ?? "",
};

// PostgresEngine instantiation
const engine: PostgresEngine = await PostgresEngine.fromInstance(
  process.env.PROJECT_ID ?? "",
  process.env.REGION ?? "",
  process.env.INSTANCE_NAME ?? "",
  process.env.DB_NAME ?? "",
  peArgs
);

const pvectorArgs: PostgresVectorStoreArgs = {
  metadataColumns: ["page", "source"],
};

const vectorStoreArgs: VectorStoreTableArgs = {
  metadataColumns: [new Column("page", "TEXT"), new Column("source", "TEXT")],
};

// Vector store table initialization
await engine.initVectorstoreTable(
  "my_vector_store_table",
  768,
  vectorStoreArgs
);
const embeddingService = new SyntheticEmbeddings({ vectorSize: 768 });

// PostgresVectorStore instantiation
const vectorStore = await PostgresVectorStore.initialize(
  engine,
  embeddingService,
  "my_vector_store_table",
  pvectorArgs
);

const document1: Document = {
  pageContent: "foo",
  metadata: { page: 0, source: "https://example.com" },
};

const document2: Document = {
  pageContent: "bar",
  metadata: { page: 1, source: "https://example.com" },
};

const document3: Document = {
  pageContent: "baz",
  metadata: { page: 2, source: "https://example.com" },
};

const documents = [document1, document2, document3];

const ids = [uuidv4(), uuidv4(), uuidv4()];

// Adding documents to the vectorStore
await vectorStore.addDocuments(documents, { ids });

// Deleting a document
const id1 = ids[0];
await vectorStore.delete({ ids: [id1] });

// Performing similaritySearch with a filter
const filter = `"source" = "https://example.com"`;
const results = await vectorStore.similaritySearch("foo", 2, filter);

for (const doc of results) {
  console.log(`* ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`);
}
