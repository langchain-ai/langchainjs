import * as uuid from "uuid";

import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MultiVectorRetriever } from "langchain/retrievers/multi_vector";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { InMemoryStore } from "@langchain/core/stores";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { Document } from "@langchain/core/documents";

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
    model: "gpt-4o-mini",
    maxRetries: 0,
  }),
  new StringOutputParser(),
]);

const summaries = await chain.batch(docs, {
  maxConcurrency: 5,
});

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

// The byteStore to use to store the original chunks
const byteStore = new InMemoryStore<Uint8Array>();

// The vectorstore to use to index the child chunks
const vectorstore = await FaissStore.fromDocuments(
  summaryDocs,
  new OpenAIEmbeddings()
);

const retriever = new MultiVectorRetriever({
  vectorstore,
  byteStore,
  idKey,
});

const keyValuePairs: [string, Document][] = docs.map((originalDoc, i) => [
  docIds[i],
  originalDoc,
]);

// Use the retriever to add the original chunks to the document store
await retriever.docstore.mset(keyValuePairs);

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
const retrieverResult = await retriever.invoke("justice breyer");
console.log(retrieverResult[0].pageContent.length);
/*
  9770
*/
