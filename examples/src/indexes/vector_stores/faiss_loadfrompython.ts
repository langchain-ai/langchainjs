import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";

// The directory of data saved from Python
const directory = "your/directory/here";

// Load the vector store from the directory
const loadedVectorStore = await FaissStore.loadFromPython(
  directory,
  new OpenAIEmbeddings()
);

// Search for the most similar document
const result = await loadedVectorStore.similaritySearch("test", 2);
console.log("result", result);
