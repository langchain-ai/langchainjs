import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";

// Create docs with a loader
const loader = new TextLoader("src/document_loaders/example_data/example.txt");
const docs = await loader.load();

// Load the docs into the vector store
const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());

// Search for the most similar document
const result = await vectorStore.similaritySearch("hello world", 1);
console.log(result);
