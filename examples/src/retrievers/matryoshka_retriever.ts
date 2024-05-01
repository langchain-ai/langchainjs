import { MatryoshkaRetriever } from "langchain/retrievers/matryoshka_retriever";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { faker } from "@faker-js/faker";

const smallEmbeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  dimensions: 512, // Min num for small
});
const largeEmbeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-large",
  dimensions: 3072, // Max num for large
});

const vectorStore = new Chroma(smallEmbeddings, {
  numDimensions: 512,
});

const retriever = new MatryoshkaRetriever({
  vectorStore,
  largeEmbeddingModel: largeEmbeddings,
  largeK: 5,
});

const irrelevantDocs = Array.from({ length: 250 }).map(
  () =>
    new Document({
      pageContent: faker.lorem.word(7), // Similar length to the relevant docs
    })
);
const relevantDocs = [
  new Document({
    pageContent: "LangChain is an open source github repo",
  }),
  new Document({
    pageContent: "There are JS and PY versions of the LangChain github repos",
  }),
  new Document({
    pageContent: "LangGraph is a new open source library by the LangChain team",
  }),
  new Document({
    pageContent: "LangChain announced GA of LangSmith last week!",
  }),
  new Document({
    pageContent: "I heart LangChain",
  }),
];
const allDocs = [...irrelevantDocs, ...relevantDocs];

/**
 * IMPORTANT:
 * The `addDocuments` method on `MatryoshkaRetriever` will
 * generate the small AND large embeddings for all documents.
 */
await retriever.addDocuments(allDocs);

const query = "What is LangChain?";
const results = await retriever.invoke(query);
console.log(results.map(({ pageContent }) => pageContent).join("\n"));
/**
I heart LangChain
LangGraph is a new open source library by the LangChain team
LangChain is an open source github repo
LangChain announced GA of LangSmith last week!
There are JS and PY versions of the LangChain github repos
 */
