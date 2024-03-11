import { OpenAIEmbeddings } from "@langchain/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { InMemoryStore } from "langchain/storage/in_memory";
import { ParentDocumentRetriever } from "langchain/retrievers/parent_document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1500 });

const jimDocs = await splitter.createDocuments([`My favorite color is blue.`]);
const jimChunkHeaderOptions = {
  chunkHeader: "DOC NAME: Jim Interview\n---\n",
  appendChunkOverlapHeader: true,
};

const pamDocs = await splitter.createDocuments([`My favorite color is red.`]);
const pamChunkHeaderOptions = {
  chunkHeader: "DOC NAME: Pam Interview\n---\n",
  appendChunkOverlapHeader: true,
};

const vectorstore = await HNSWLib.fromDocuments([], new OpenAIEmbeddings());
const docstore = new InMemoryStore();

const retriever = new ParentDocumentRetriever({
  vectorstore,
  docstore,
  childSplitter: new RecursiveCharacterTextSplitter({ chunkSize: 150 }),
  childK: 50,
  parentK: 5,
});

// We pass additional option `chunkHeader` that will add metadata chunk header to child documents
await retriever.addDocuments(jimDocs, {
  chunkHeaderOptions: jimChunkHeaderOptions,
});
await retriever.addDocuments(pamDocs, {
  chunkHeaderOptions: pamChunkHeaderOptions,
});

// Documents added to vector store have this, search friendly format
/*
  [
    Document { pageContent: 'DOC NAME: Jim Interview\n---\n My favorite color is blue.' },
    Document { pageContent: 'DOC NAME: Pam Interview\n---\n My favorite color is red.' },
  ]
*/

// this will search child documents in vector store with the help of chunk header
const retrievedDocs = await retriever.getRelevantDocuments(
  "What is Pam's favorite color?"
);

// Retrieved chunk is the larger parent chunk. We also added chunk header there so LLM can use it to provide correct
// answer
console.log(retrievedDocs);
/*
  [
    Document {
      pageContent: 'My favorite color is red.'
    },
  ]
*/
