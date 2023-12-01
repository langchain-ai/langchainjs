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
     {
       "pageContent": "In the room the women come and go talking of Michelangelo",
       "metadata": [
         {
           "name": "lang",
           "value": "eng"
         },
         {
           "name": "offset",
           "value": "0"
         },
         {
           "name": "len",
           "value": "57"
         }
       ]
     },
     0.38169062
   ]
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

console.log(JSON.stringify(summary, null, 2));
/*
{
 "documents": [
  [
    {
      "pageContent": "In the room the women come and go talking of Michelangelo",
      "metadata": [
        {
          "name": "lang",
          "value": "eng"
        },
        {
          "name": "offset",
          "value": "0"
        },
        {
          "name": "len",
          "value": "57"
        }
      ]
    },
    0.38169062
  ]
],
"summary": [
  {
     "text": "Nella stanza le donne vanno e vengono parlando di Michelangelo. Inoltre, sembra che stiano valutando se mangiare una pesca.",
     "lang": "ita",
     "prompt": "",
     "status": [],
     "futureId": 2
  }
 ]
}
*/

// Delete the documents.
await store.deleteDocuments(doc_ids);
