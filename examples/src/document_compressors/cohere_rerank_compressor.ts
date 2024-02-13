import { CohereRerank } from "@langchain/cohere";
import { Document } from "@langchain/core/documents";

const query = "What is the capital of the United States?";
const docs = [
  new Document({
    pageContent:
      "Carson City is the capital city of the American state of Nevada. At the 2010 United States Census, Carson City had a population of 55,274.",
  }),
  new Document({
    pageContent:
      "The Commonwealth of the Northern Mariana Islands is a group of islands in the Pacific Ocean that are a political division controlled by the United States. Its capital is Saipan.",
  }),
  new Document({
    pageContent:
      "Charlotte Amalie is the capital and largest city of the United States Virgin Islands. It has about 20,000 people. The city is on the island of Saint Thomas.",
  }),
  new Document({
    pageContent:
      "Washington, D.C. (also known as simply Washington or D.C., and officially as the District of Columbia) is the capital of the United States. It is a federal district. The President of the USA and many major national government offices are in the territory. This makes it the political center of the United States of America.",
  }),
  new Document({
    pageContent:
      "Capital punishment (the death penalty) has existed in the United States since before the United States was a country. As of 2017, capital punishment is legal in 30 of the 50 states. The federal government (including the United States military) also uses capital punishment.",
  }),
];

const cohereRerank = new CohereRerank({
  apiKey: process.env.COHERE_API_KEY, // Default
  topN: 3, // Default
  model: "rerank-english-v2.0", // Default
});

const rerankedDocuments = await cohereRerank.compressDocuments(docs, query);

console.log(rerankedDocuments);
/**
[
  Document {
    pageContent: 'Washington, D.C. (also known as simply Washington or D.C., and officially as the District of Columbia) is the capital of the United States. It is a federal district. The President of the USA and many major national government offices are in the territory. This makes it the political center of the United States of America.',
    metadata: { relevanceScore: 0.9871293 }
  },
  Document {
    pageContent: 'The Commonwealth of the Northern Mariana Islands is a group of islands in the Pacific Ocean that are a political division controlled by the United States. Its capital is Saipan.',
    metadata: { relevanceScore: 0.29961726 }
  },
  Document {
    pageContent: 'Capital punishment (the death penalty) has existed in the United States since before the United States was a country. As of 2017, capital punishment is legal in 30 of the 50 states. The federal government (including the United States military) also uses capital punishment.',
    metadata: { relevanceScore: 0.27542195 }
  }
]
 */
