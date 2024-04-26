import { VectaraStore } from "@langchain/community/vectorstores/vectara";
import { VectaraSummaryRetriever } from "@langchain/community/retrievers/vectara_summary";
import { Document } from "@langchain/core/documents";

// Create the Vectara store.
const store = new VectaraStore({
  customerId: Number(process.env.VECTARA_CUSTOMER_ID),
  corpusId: Number(process.env.VECTARA_CORPUS_ID),
  apiKey: String(process.env.VECTARA_API_KEY),
  verbose: true,
});

// Add two documents with some metadata.
const doc_ids = await store.addDocuments([
  new Document({
    pageContent: "Do I dare to eat a peach?",
    metadata: {
      foo: "baz",
    },
  }),
  new Document({
    pageContent: "In the room the women come and go talking of Michelangelo",
    metadata: {
      foo: "bar",
    },
  }),
]);

// Perform a similarity search.
const resultsWithScore = await store.similaritySearchWithScore(
  "What were the women talking about?",
  1,
  {
    lambda: 0.025,
  }
);

// Print the results.
console.log(JSON.stringify(resultsWithScore, null, 2));
/*
[
  [
    {
      "pageContent": "In the room the women come and go talking of Michelangelo",
      "metadata": {
        "lang": "eng",
        "offset": "0",
        "len": "57",
        "foo": "bar"
      }
    },
    0.4678752
  ]
]
*/

const retriever = new VectaraSummaryRetriever({ vectara: store, topK: 3 });
const documents = await retriever.invoke("What were the women talking about?");

console.log(JSON.stringify(documents, null, 2));
/*
[
  {
    "pageContent": "<b>In the room the women come and go talking of Michelangelo</b>",
    "metadata": {
      "lang": "eng",
      "offset": "0",
      "len": "57",
      "foo": "bar"
    }
  },
  {
    "pageContent": "<b>In the room the women come and go talking of Michelangelo</b>",
    "metadata": {
      "lang": "eng",
      "offset": "0",
      "len": "57",
      "foo": "bar"
    }
  },
  {
    "pageContent": "<b>In the room the women come and go talking of Michelangelo</b>",
    "metadata": {
      "lang": "eng",
      "offset": "0",
      "len": "57",
      "foo": "bar"
    }
  }
]
*/

// Delete the documents.
await store.deleteDocuments(doc_ids);
