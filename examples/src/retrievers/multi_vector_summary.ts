import * as uuid from "uuid";

import { ChatOpenAI } from "langchain/chat_models/openai";
import { PromptTemplate } from "langchain/prompts";
import { StringOutputParser } from "langchain/schema/output_parser";
import { RunnableSequence } from "langchain/schema/runnable";

import { MultiVectorRetriever } from "langchain/retrievers/multi_vector";
import { FaissStore } from "langchain/vectorstores/faiss";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { InMemoryStore } from "langchain/storage/in_memory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { Document } from "langchain/document";

const textLoader = new TextLoader("../examples/state_of_the_union.txt");
const parentDocuments = await textLoader.load();

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 10000,
  chunkOverlap: 20,
});

const docs = await splitter.splitDocuments(parentDocuments);

const chain = RunnableSequence.from([
  { content: (doc: Document) => doc.pageContent },
  PromptTemplate.fromTemplate(`Summarize the following document:\n\n{content}`),
  new ChatOpenAI({
    maxRetries: 0,
  }),
  new StringOutputParser(),
]);

const summaries = await chain.batch(
  docs,
  {},
  {
    maxConcurrency: 5,
  }
);

const idKey = "doc_id";
const docIds = docs.map((_) => uuid.v4());
const summaryDocs = summaries.map((summary, i) => {
  const summaryDoc = new Document({
    pageContent: summary,
    metadata: {
      [idKey]: docIds[i],
    },
  });
  return summaryDoc;
});

const keyValuePairs: [string, Document][] = docs.map((originalDoc, i) => [
  docIds[i],
  originalDoc,
]);

// The docstore to use to store the original chunks
const docstore = new InMemoryStore();
await docstore.mset(keyValuePairs);

// The vectorstore to use to index the child chunks
const vectorstore = await FaissStore.fromDocuments(
  summaryDocs,
  new OpenAIEmbeddings()
);

const retriever = new MultiVectorRetriever({
  vectorstore,
  docstore,
  idKey,
});

// We could also add the original chunks to the vectorstore if we wish
// const taggedOriginalDocs = docs.map((doc, i) => {
//   doc.metadata[idKey] = docIds[i];
//   return doc;
// });
// retriever.vectorstore.addDocuments(taggedOriginalDocs);

// Vectorstore alone retrieves the small chunks
const vectorstoreResult = await retriever.vectorstore.similaritySearch(
  "justice breyer"
);
console.log(vectorstoreResult[0].pageContent.length);
/*
  1118
*/

// Retriever returns larger result
const retrieverResult = await retriever.getRelevantDocuments("justice breyer");
console.log(retrieverResult[0].pageContent.length);
/*
  9770
*/
