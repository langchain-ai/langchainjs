import { VoyVectorStore } from "langchain/vectorstores/voy";
import { Voy as VoyClient } from "voy-search";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Document } from "langchain/document";

// Create Voy client using the library.
const voyClient = new VoyClient();
// Create embeddings
const embeddings = new OpenAIEmbeddings();
// Create the Voy store.
const store = new VoyVectorStore(voyClient, embeddings);

// Add two documents with some metadata.
await store.addDocuments([
  new Document({
    pageContent: "How has life been treating you?",
    metadata: {
      foo: "Mike",
    },
  }),
  new Document({
    pageContent: "And I took it personally...",
    metadata: {
      foo: "Testing",
    },
  }),
]);

const model = new OpenAIEmbeddings();
const query = await model.embedQuery("And I took it personally");

// Perform a similarity search.
const resultsWithScore = await store.similaritySearchVectorWithScore(query, 1);

// Print the results.
console.log(JSON.stringify(resultsWithScore, null, 2));
/*
  [
    [
      {
        "pageContent": "And I took it personally...",
        "metadata": {
          "foo": "Testing"
        }
      },
      0
    ]
  ]
*/
