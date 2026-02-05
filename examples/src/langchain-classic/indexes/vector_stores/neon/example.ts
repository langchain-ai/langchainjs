import { OpenAIEmbeddings } from "@langchain/openai";
import { NeonPostgres } from "@langchain/community/vectorstores/neon";

// Initialize an embeddings instance
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  dimensions: 256,
  model: "text-embedding-3-small",
});

// Initialize a NeonPostgres instance to store embedding vectors
const vectorStore = await NeonPostgres.initialize(embeddings, {
  connectionString: process.env.DATABASE_URL as string,
});

// You can add documents to the store, strings in the `pageContent` field will be embedded
// and stored in the database
const documents = [
  { pageContent: "Hello world", metadata: { topic: "greeting" } },
  { pageContent: "Bye bye", metadata: { topic: "greeting" } },
  {
    pageContent: "Mitochondria is the powerhouse of the cell",
    metadata: { topic: "science" },
  },
];
const idsInserted = await vectorStore.addDocuments(documents);

// You can now query the store for similar documents to the input query
const resultOne = await vectorStore.similaritySearch("hola", 1);
console.log(resultOne);
/*
[
  Document {
    pageContent: 'Hello world',
    metadata: { topic: 'greeting' }
  }
]
*/

// You can also filter by metadata
const resultTwo = await vectorStore.similaritySearch("Irrelevant query", 2, {
  topic: "science",
});
console.log(resultTwo);
/*
[
  Document {
    pageContent: 'Mitochondria is the powerhouse of the cell',
    metadata: { topic: 'science' }
  }
]
*/

// Metadata filtering with IN-filters works as well
const resultsThree = await vectorStore.similaritySearch("Irrelevant query", 2, {
  topic: { in: ["greeting"] },
});
console.log(resultsThree);
/*
[
  Document { pageContent: 'Bye bye', metadata: { topic: 'greeting' } },
  Document {
    pageContent: 'Hello world',
    metadata: { topic: 'greeting' }
  }
]
*/

// Upserting is supported as well
await vectorStore.addDocuments(
  [
    {
      pageContent: "ATP is the powerhouse of the cell",
      metadata: { topic: "science" },
    },
  ],
  { ids: [idsInserted[2]] }
);

const resultsFour = await vectorStore.similaritySearch(
  "powerhouse of the cell",
  1
);
console.log(resultsFour);
/*
[
  Document {
    pageContent: 'ATP is the powerhouse of the cell',
    metadata: { topic: 'science' }
  }
]
*/
