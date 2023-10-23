// If you want to import the browser version, use the following line instead:
// import { CloseVectorWeb } from "langchain/vectorstores/closevector/web";
import { CloseVectorNode } from "langchain/vectorstores/closevector/node";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";

// Create docs with a loader
const loader = new TextLoader("src/document_loaders/example_data/example.txt");
const docs = await loader.load();

// Load the docs into the vector store
// If you want to import the browser version, use the following line instead:
// const vectorStore = await CloseVectorWeb.fromDocuments(
const vectorStore = await CloseVectorNode.fromDocuments(
  docs,
  new OpenAIEmbeddings()
);

// Search for the most similar document
const resultOne = await vectorStore.similaritySearch("hello world", 1);
console.log(resultOne);
