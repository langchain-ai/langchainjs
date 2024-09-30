import { OpenAIEmbeddings } from "@langchain/openai";
import { LibSQLVectorStore } from "@langchain/community/vectorstores/libsql";
import { createClient } from "@libsql/client";

// Initialize a new libSQL client
const client = createClient({
  url: "libsql://[database-name]-[your-username].turso.io",
  authToken: "...",
});

// Initialize a new embeddings instance
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  dimensions: 256,
  model: "text-embedding-3-small",
});

// Initialize a new LibSQLVectorStore instance to store embedding vectors
const vectorStore = new LibSQLVectorStore(client, embeddings, {
  tableName: "TABLE_NAME",
  embeddingColumn: "EMBEDDING_COLUMN",
  dimensions: 153,
});

// Add documents to the store
const documents = [
  { pageContent: "Hello", metadata: { topic: "greeting" } },
  { pageContent: "Bye bye", metadata: { topic: "greeting" } },
];
const idsInserted = await vectorStore.addDocuments(documents);

// You can now query the store for similar documents to the input query
const resultOne = await vectorStore.similaritySearch("hola", 1);
console.log(resultOne);
/*
[
  Document {
    pageContent: 'Hello',
    metadata: { topic: 'greeting' }
  }
]
*/
