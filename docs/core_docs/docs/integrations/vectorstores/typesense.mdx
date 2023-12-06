# Typesense

Vector store that utilizes the Typesense search engine.

### Basic Usage

```typescript
import { Typesense, TypesenseConfig } from "langchain/vectorstores/typesense";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Client } from "typesense";
import { Document } from "langchain/document";

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
  // Optional column names to be used in Typesense
  columnNames: {
    // "vec" is the default name for the vector column in Typesense but you can change it to whatever you want
    vector: "vec",
    // "text" is the default name for the text column in Typesense but you can change it to whatever you want
    pageContent: "text",
    // Names of the columns that you will save in your typesense schema and need to be retrieved as metadata when searching
    metadataColumnNames: ["foo", "bar", "baz"],
  },
  // Optional search parameters to be passed to Typesense when searching
  searchParams: {
    q: "*",
    filter_by: "foo:[fooo]",
    query_by: "",
  },
  // You can override the default Typesense import function if you want to do something more complex
  // Default import function:
  // async importToTypesense<
  //   T extends Record<string, unknown> = Record<string, unknown>
  // >(data: T[], collectionName: string) {
  //   const chunkSize = 2000;
  //   for (let i = 0; i < data.length; i += chunkSize) {
  //     const chunk = data.slice(i, i + chunkSize);

  //     await this.caller.call(async () => {
  //       await this.client
  //         .collections<T>(collectionName)
  //         .documents()
  //         .import(chunk, { action: "emplace", dirty_values: "drop" });
  //     });
  //   }
  // }
  import: async (data, collectionName) => {
    await vectorTypesenseClient
      .collections(collectionName)
      .documents()
      .import(data, { action: "emplace", dirty_values: "drop" });
  },
} satisfies TypesenseConfig;

/**
 * Creates a Typesense vector store from a list of documents.
 * Will update documents if there is a document with the same id, at least with the default import function.
 * @param documents list of documents to create the vector store from
 * @returns Typesense vector store
 */
const createVectorStoreWithTypesense = async (documents: Document[] = []) =>
  Typesense.fromDocuments(
    documents,
    new OpenAIEmbeddings(),
    typesenseVectorStoreConfig
  );

/**
 * Returns a Typesense vector store from an existing index.
 * @returns Typesense vector store
 */
const getVectorStoreWithTypesense = async () =>
  new Typesense(new OpenAIEmbeddings(), typesenseVectorStoreConfig);

// Do a similarity search
const vectorStore = await getVectorStoreWithTypesense();
const documents = await vectorStore.similaritySearch("hello world");

// Add filters based on metadata with the search parameters of Typesense
// will exclude documents with author:JK Rowling, so if Joe Rowling & JK Rowling exists, only Joe Rowling will be returned
vectorStore.similaritySearch("Rowling", undefined, {
  filter_by: "author:!=JK Rowling",
});

// Delete a document
vectorStore.deleteDocuments(["document_id_1", "document_id_2"]);
```

### Constructor

Before starting, create a schema in Typesense with an id, a field for the vector and a field for the text. Add as many other fields as needed for the metadata.

- `constructor(embeddings: Embeddings, config: TypesenseConfig)`: Constructs a new instance of the `Typesense` class.
  - `embeddings`: An instance of the `Embeddings` class used for embedding documents.
  - `config`: Configuration object for the Typesense vector store.
    - `typesenseClient`: Typesense client instance.
    - `schemaName`: Name of the Typesense schema in which documents will be stored and searched.
    - `searchParams` (optional): Typesense search parameters. Default is `{ q: '*', per_page: 5, query_by: '' }`.
    - `columnNames` (optional): Column names configuration.
      - `vector` (optional): Vector column name. Default is `'vec'`.
      - `pageContent` (optional): Page content column name. Default is `'text'`.
      - `metadataColumnNames` (optional): Metadata column names. Default is an empty array `[]`.
    - `import` (optional): Replace the default import function for importing data to Typesense. This can affect the functionality of updating documents.

### Methods

- `async addDocuments(documents: Document[]): Promise<void>`: Adds documents to the vector store. The documents will be updated if there is a document with the same ID.
- `static async fromDocuments(docs: Document[], embeddings: Embeddings, config: TypesenseConfig): Promise<Typesense>`: Creates a Typesense vector store from a list of documents. Documents are added to the vector store during construction.
- `static async fromTexts(texts: string[], metadatas: object[], embeddings: Embeddings, config: TypesenseConfig): Promise<Typesense>`: Creates a Typesense vector store from a list of texts and associated metadata. Texts are converted to documents and added to the vector store during construction.
- `async similaritySearch(query: string, k?: number, filter?: Record<string, unknown>): Promise<Document[]>`: Searches for similar documents based on a query. Returns an array of similar documents.
- `async deleteDocuments(documentIds: string[]): Promise<void>`: Deletes documents from the vector store based on their IDs.
