import "@tensorflow/tfjs-backend-cpu";
import { Document } from "langchain/document";
import { TensorFlowEmbeddings } from "langchain/embeddings/tensorflow";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

const embeddings = new TensorFlowEmbeddings();
const store = new MemoryVectorStore(embeddings);

const documents = [
  "A document",
  "Some other piece of text",
  "One more",
  "And another",
];

await store.addDocuments(
  documents.map((pageContent) => new Document({ pageContent }))
);
