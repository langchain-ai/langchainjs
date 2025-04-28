import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "@langchain/openai";

// Create a vector store through any method, here from texts as an example
const vectorStore = await HNSWLib.fromTexts(
  ["Hello world", "Bye bye", "hello nice world"],
  [{ id: 2 }, { id: 1 }, { id: 3 }],
  new OpenAIEmbeddings()
);

// Save the vector store to a directory
const directory = "your/directory/here";
await vectorStore.save(directory);

// Load the vector store from the same directory
const loadedVectorStore = await HNSWLib.load(directory, new OpenAIEmbeddings());

// vectorStore and loadedVectorStore are identical

const result = await loadedVectorStore.similaritySearch("hello world", 1);
console.log(result);
