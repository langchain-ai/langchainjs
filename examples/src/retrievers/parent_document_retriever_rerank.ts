import { OpenAIEmbeddings } from "@langchain/openai";
import { CohereRerank } from "@langchain/cohere";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { InMemoryStore } from "langchain/storage/in_memory";
import {
  ParentDocumentRetriever,
  type SubDocs,
} from "langchain/retrievers/parent_document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

// init Cohere Rerank. Remember to add COHERE_API_KEY to your .env
const reranker = new CohereRerank({
  topN: 50,
  model: "rerank-multilingual-v2.0",
});

export function documentCompressorFiltering({
  relevanceScore,
}: { relevanceScore?: number } = {}) {
  return (docs: SubDocs) => {
    let outputDocs = docs;

    if (relevanceScore) {
      const docsRelevanceScoreValues = docs.map(
        (doc) => doc?.metadata?.relevanceScore
      );
      outputDocs = docs.filter(
        (_doc, index) =>
          (docsRelevanceScoreValues?.[index] || 1) >= relevanceScore
      );
    }

    return outputDocs;
  };
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 0,
});

const jimDocs = await splitter.createDocuments([`Jim favorite color is blue.`]);

const pamDocs = await splitter.createDocuments([`Pam favorite color is red.`]);

const vectorstore = await HNSWLib.fromDocuments([], new OpenAIEmbeddings());
const docstore = new InMemoryStore();

const retriever = new ParentDocumentRetriever({
  vectorstore,
  docstore,
  // Very small chunks for demo purposes.
  // Use a bigger chunk size for serious use-cases.
  childSplitter: new RecursiveCharacterTextSplitter({
    chunkSize: 10,
    chunkOverlap: 0,
  }),
  childK: 50,
  parentK: 5,
  // We add Reranker
  documentCompressor: reranker,
  documentCompressorFilteringFn: documentCompressorFiltering({
    relevanceScore: 0.3,
  }),
});

const docs = jimDocs.concat(pamDocs);
await retriever.addDocuments(docs);

// This will search for documents in vector store and return for LLM already reranked and sorted document
// with appropriate minimum relevance score
const retrievedDocs = await retriever.getRelevantDocuments(
  "What is Pam's favorite color?"
);

// Pam's favorite color is returned first!
console.log(JSON.stringify(retrievedDocs, null, 2));
/*
  [
    {
      "pageContent": "My favorite color is red.",
      "metadata": {
        "relevanceScore": 0.9
        "loc": {
          "lines": {
            "from": 1,
            "to": 1
          }
        }
      }
    }
  ]
*/
