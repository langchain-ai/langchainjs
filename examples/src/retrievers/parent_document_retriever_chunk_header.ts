import { OpenAIEmbeddings } from "@langchain/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { InMemoryStore } from "langchain/storage/in_memory";
import { ParentDocumentRetriever } from "langchain/retrievers/parent_document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { ScoreThresholdRetriever } from "langchain/retrievers/score_threshold";


const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1500 });

const jimChunkHeader = `DOC NAME: Jim Interview\\n---\\n`;
const jimDocs = await splitter.createDocuments(
  [`My favorite color is blue.`],
  [{
    chunkHeader: jimChunkHeader
  }],
  {
    chunkHeader: jimChunkHeader,
    appendChunkOverlapHeader: true,
  }
);


const pamChunkHeader = `DOC NAME: Pam Interview\\n---\\n`;
const pamDocs = await splitter.createDocuments(
  [`My favorite color is red.`],
  [{
    chunkHeader: pamChunkHeader
  }],
  {
    chunkHeader: pamChunkHeader,
    appendChunkOverlapHeader: true,
  }
);

const vectorstore = await HNSWLib.fromDocuments([], new OpenAIEmbeddings());
const docstore = new InMemoryStore();

const retriever = new ParentDocumentRetriever({
  vectorstore,
  docstore,
  childSplitter: new RecursiveCharacterTextSplitter({ chunkSize: 150 }),
  childK: 50,
  parentK: 5
});
const documents = [].concat(jimDocs, pamDocs);

// We pass additional option `chunkHeader` that will add metadata chunk header to documents
await retriever.addDocuments(documents, { chunkHeader: true });
// Documents added to vector store have this, search friendly format
/*
  [
    Document { pageContent: 'DOC NAME: Jim Interview\n---\n My favorite color is blue.' },
    Document { pageContent: 'DOC NAME: Pam Interview\n---\n My favorite color is red.' },
  ]
*/

const retrievedDocs = await retriever.getRelevantDocuments("What is Pam's favorite color?");

// Retrieved chunk is the larger parent chunk
console.log(retrievedDocs);
/*
  [
    Document {
      pageContent: 'DOC NAME: Pam Interview\n---\n My favorite color is red.'
    },
  ]
*/
