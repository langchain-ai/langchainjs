import { VectaraStore, VectaraRetriever } from "langchain/vectorstores/vectara";
import { Document } from "langchain/document";

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
    [
      {
        "pageContent": "In the room the women come and go talking of Michelangelo",
        "metadata": {
          "lang": "eng",
          "offset": "0",
          "len": "57",
          "foo": "bar"
        }
      }
    ],
    0.69189274
  ]
*/

const retriever = new VectaraRetriever({vectara: store, topK: 3});
const [documents, summary] = await retriever.getRelevantDocumentsAndSummary(
  "What were the women talking about?",
  {
    lambda: 0.025,
  },
  {
    enabled: true,
    maxSummarizedResults: 3,
    responseLang: "ita",
  }
);

console.log(JSON.stringify(documents, null, 2));
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
    }
  ],
  [
    {
      "pageContent": "Do I dare to eat a peach?",
      "metadata": {
        "lang": "eng",
        "offset": "0",
        "len": "25",
        "foo": "baz"
      }
    }
  ]
]
*/

console.log(JSON.stringify(summary, null, 2));
/*
"I risultati della ricerca non contenevano informazioni sufficienti per essere riassunti in una risposta utile alla tua domanda. 
Ti prego di provare una ricerca diversa o di riformulare la tua domanda in modo diverso."
*/

// Delete the documents.
await store.deleteDocuments(doc_ids);
