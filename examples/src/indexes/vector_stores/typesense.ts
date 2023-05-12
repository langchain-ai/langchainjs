import { Typesense } from "langchain/vectorstores/typesense";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Client } from "typesense";

const vectorTypesenseClient = new Client({
  nodes: [
    {
      // Ideally should come from your .env file
      host: "...",
      port: 123,
      protocol: "https",
    },
  ],
  // Ideally should come from your .env file
  apiKey: "...",
  numRetries: 3,
  connectionTimeoutSeconds: 60,
});

const typesenseVectorStoreConfig = {
  // Typesense client
  typesenseClient: vectorTypesenseClient,
  // Name of the collection to store the vectors in
  schemaName: "your_schema_name",
  columnNames: {
    // "vec" is the default name for the vector column in Typesense but you can change it to whatever you want
    vector: "vec",
    // "text" is the default name for the text column in Typesense but you can change it to whatever you want
    pageContent: "text",
    // Names of the columns that you will save in your typesense schema and need to be retrieved as metadata when searching
    metadataColumnNames: ["foo", "bar", "baz"],
  },
};

/**
 * Creates a Typesense vector store from a list of documents.
 * @param documents list of documents to create the vector store from
 * @returns Typesense vector store
 */
const createVectorStoreWithTypesense = async (documents: Document[] = []) => {
  return Typesense.fromDocuments(
    documents,
    new OpenAIEmbeddings(),
    typesenseVectorStoreConfig
  );
};

/**
 * Returns a Typesense vector store from an existing index.
 * @returns Typesense vector store
 */
const getVectorStoreWithTypesense = async () => {
  return new Typesense(new OpenAIEmbeddings(), typesenseVectorStoreConfig);
};
