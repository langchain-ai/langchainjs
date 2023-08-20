import { VectaraStore } from "langchain/vectorstores/vectara";
import { Document } from "langchain/document";

// Create the Vectara store.
const store = new VectaraStore({
  customerId: Number(process.env.VECTARA_CUSTOMER_ID),
  corpusId: Number(process.env.VECTARA_CORPUS_ID),
  apiKey: String(process.env.VECTARA_API_KEY),
  verbose: true,
});

// Add two documents with some metadata.
await store.addDocuments([
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

const resultsWithSummary = await store.similaritySearchWithSummary(
  "What were the women talking about?",
  1,
  {
    lambda: 0.025,
    summary: [
      {
        summarizerPromptName: "vectara-summary-ext-v1.2.0",
        maxSummarizedResults: 3,
        responseLang: "ita",
      },
    ],
  }
);

console.log(JSON.stringify(resultsWithSummary, null, 2));
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