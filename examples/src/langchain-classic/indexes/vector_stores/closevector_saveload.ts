// If you want to import the browser version, use the following line instead:
// import { CloseVectorWeb } from "@langchain/community/vectorstores/closevector/web";
import { CloseVectorNode } from "@langchain/community/vectorstores/closevector/node";
import { OpenAIEmbeddings } from "@langchain/openai";

// Create a vector store through any method, here from texts as an example
// If you want to import the browser version, use the following line instead:
// const vectorStore = await CloseVectorWeb.fromTexts(
const vectorStore = await CloseVectorNode.fromTexts(
  ["Hello world", "Bye bye", "hello nice world"],
  [{ id: 2 }, { id: 1 }, { id: 3 }],
  new OpenAIEmbeddings()
);

// Save the vector store to a directory
const directory = "your/directory/here";

await vectorStore.save(directory);

// Load the vector store from the same directory
// If you want to import the browser version, use the following line instead:
// const loadedVectorStore = await CloseVectorWeb.load(
const loadedVectorStore = await CloseVectorNode.load(
  directory,
  new OpenAIEmbeddings()
);

// vectorStore and loadedVectorStore are identical
const result = await loadedVectorStore.similaritySearch("hello world", 1);
console.log(result);
