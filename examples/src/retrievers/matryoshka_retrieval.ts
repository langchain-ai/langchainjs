import { MatryoshkaRetrieval } from "@langchain/community/retrievers/matryoshka_retrieval";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { v4 as uuidV4 } from "uuid";
import { faker } from "@faker-js/faker";

const smallEmbeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  dimensions: 512, // Min num for small
});
const largeEmbeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-large",
  dimensions: 3072, // Max num for large
});

const smallStore = new Chroma(smallEmbeddings, {
  numDimensions: 512,
  collectionName: "adaptive-retrieval-small",
});
const largeStore = new Chroma(largeEmbeddings, {
  numDimensions: 3072,
  collectionName: "adaptive-retrieval-large",
});

const retriever = new MatryoshkaRetrieval({
  smallStore,
  largeStore,
});

/**
 * IMPORTANT:
 * All documents must have some sort of unique identifier inside
 * the metadata. You may customize the key (defaults to "id") by
 * passing an `idKey` option to the constructor.
 */
const irrelevantDocs = Array.from({ length: 250 }).map(
  () =>
    new Document({
      pageContent: faker.lorem.paragraph(5),
      metadata: { id: uuidV4() },
    })
);
const relevantDocs = [
  new Document({
    pageContent: "LangChain is an open source github repo",
    metadata: { id: uuidV4() },
  }),
  new Document({
    pageContent: "There are JS and PY versions of the LangChain github repos",
    metadata: { id: uuidV4() },
  }),
  new Document({
    pageContent: "LangGraph is a new open source library by the LangChain team",
    metadata: { id: uuidV4() },
  }),
  new Document({
    pageContent: "LangChain announced GA of LangSmith last week!",
    metadata: { id: uuidV4() },
  }),
  new Document({
    pageContent: "I heart LangChain",
    metadata: { id: uuidV4() },
  }),
];
const allDocs = [...irrelevantDocs, ...relevantDocs];

/**
 * IMPORTANT:
 * The `addDocuments` method on `MatryoshkaRetrieval` will
 * insert documents into BOTH the small and large vector stores.
 */
await retriever.addDocuments(allDocs);

const query = "What is LangChain?";
const results = await retriever.getRelevantDocuments(query);
console.log(results.map(({ pageContent }) => pageContent).join("\n"));
/**
I heart LangChain
LangGraph is a new open source library by the LangChain team
LangChain is an open source github repo
LangChain announced GA of LangSmith last week!
There are JS and PY versions of the LangChain github repos
 */
