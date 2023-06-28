import { VectaraStore } from "langchain/vectorstores/vectara";
import { Document } from "langchain/document";

// Create the store.
const store = new VectaraStore({
  customerId: Number(process.env.VECTARA_CUSTOMER_ID),
  corpusId: Number(process.env.VECTARA_CORPUS_ID),
  apiKey: String(process.env.VECTARA_API_KEY),
  verbose: true,
});

// Store your data.
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

// "Added 2 documents to Vectara"

const resultsWithScore = await store.similaritySearchWithScore(
  "What were the women talking about?",
  1,
  {
    lambda: 0.025,
  }
);

console.log(JSON.stringify(resultsWithScore, null, 2));
// [
//   [
//     {
//       "pageContent": "In the room the women come and go talking of Michelangelo",
//       "metadata": [
//         {
//           "name": "lang",
//           "value": "eng"
//         },
//         {
//           "name": "offset",
//           "value": "0"
//         },
//         {
//           "name": "len",
//           "value": "57"
//         }
//       ]
//     },
//     0.38169062
//   ]
// ]
