import * as uuid from "uuid";

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

const idKey = "doc_id";
const docIds = docs.map((_) => uuid.v4());

const childSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 400,
  chunkOverlap: 0,
});

const subDocs = [];
for (let i = 0; i < docs.length; i += 1) {
  const childDocs = await childSplitter.splitDocuments([docs[i]]);
  const taggedChildDocs = childDocs.map((childDoc) => {
    // eslint-disable-next-line no-param-reassign
    childDoc.metadata[idKey] = docIds[i];
    return childDoc;
  });
  subDocs.push(...taggedChildDocs);
}

const keyValuePairs: [string, Document][] = docs.map((doc, i) => [
  docIds[i],
  doc,
]);

// The docstore to use to store the original chunks
const docstore = new InMemoryStore();
await docstore.mset(keyValuePairs);

// The vectorstore to use to index the child chunks
const vectorstore = await FaissStore.fromDocuments(
  subDocs,
  new OpenAIEmbeddings()
);

const retriever = new MultiVectorRetriever({
  vectorstore,
  docstore,
  idKey,
  // Optional `k` parameter to search for more child documents in VectorStore.
  // Note that this does not exactly correspond to the number of final (parent) documents
  // retrieved, as multiple child documents can point to the same parent.
  childK: 20,
  // Optional `k` parameter to limit number of final, parent documents returned from this
  // retriever and sent to LLM. This is an upper-bound, and the final count may be lower than this.
  parentK: 5,
});

// Vectorstore alone retrieves the small chunks
const vectorstoreResult = await retriever.vectorstore.similaritySearch(
  "justice breyer"
);
console.log(vectorstoreResult[0].pageContent.length);
/*
  390
*/

// Retriever returns larger result
const retrieverResult = await retriever.getRelevantDocuments("justice breyer");
console.log(retrieverResult[0].pageContent.length);
/*
  9770
*/
