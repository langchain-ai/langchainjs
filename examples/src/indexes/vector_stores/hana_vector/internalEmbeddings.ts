import { Document } from "@langchain/core/documents";
import hanaClient from "hdb";
import { HanaInternalEmbeddings } from "@langchain/community/embeddings/hana_internal";
import {
  HanaDB,
  HanaDBArgs,
} from "@langchain/community/vectorstores/hanavector";

// Initialize the internal embeddings instance using the internal model ID.
// This instance will use SAP HANA's built-in VECTOR_EMBEDDING function of HanaDB.
const internalEmbeddings = new HanaInternalEmbeddings({
  internalEmbeddingModelId:
    process.env.HANA_DB_EMBEDDING_MODEL_ID || "SAP_NEB.20240715",
});

// Set up connection parameters from environment variables.
const connectionParams = {
  host: process.env.HANA_HOST,
  port: process.env.HANA_PORT,
  user: process.env.HANA_UID,
  password: process.env.HANA_PWD,
};

// Create a HANA client.
const client = hanaClient.createClient(connectionParams);

// Connect to SAP HANA.
await new Promise<void>((resolve, reject) => {
  client.connect((err: Error) => {
    if (err) {
      reject(err);
    } else {
      console.log("Connected to SAP HANA successfully.");
      resolve();
    }
  });
});

// Define the arguments for the vector store instance.
// Check the interface to see all possible options.
const args: HanaDBArgs = {
  connection: client,
  tableName: "testInternalEmbeddings",
};

// Create a new HanaDB vector store using the internal embeddings instance.
// This vector store leverages the internal VECTOR_EMBEDDING function of HanaDB.
const vectorStore = new HanaDB(internalEmbeddings, args);
// Initialize the vector store (creates the table and verifies its columns).
await vectorStore.initialize();

// Example documents to index.
const docs: Document[] = [
  new Document({
    pageContent: "Charlie is a data scientist who specializes in AI research.",
    metadata: { name: "Charlie Brown" },
  }),
  new Document({
    pageContent:
      "David is a teacher with a passion for history and literature.",
    metadata: { name: "David Williams" },
  }),
  new Document({
    pageContent:
      "Eve is an entrepreneur focusing on blockchain and cryptocurrency.",
    metadata: { name: "Eve Adams" },
  }),
];

// Clean up any existing documents in the table.
await vectorStore.delete({ filter: {} });
// Add the example documents.
await vectorStore.addDocuments(docs);

// Perform a similarity search. In this example, we search for documents related to "bitcoin".
const results = await vectorStore.similaritySearch("bitcoin", 1);
console.log("Similarity search results:", results);
/*
  [
    {
      pageContent: 'Eve is an entrepreneur focusing on blockchain and cryptocurrency.',
      metadata: { name: 'Eve Adams' }
    }
  ]
*/

// Disconnect from SAP HANA after operations.
client.disconnect();
