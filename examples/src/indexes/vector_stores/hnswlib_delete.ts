import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "@langchain/openai";

// Save the vector store to a directory
const directory = "your/directory/here";

// Load the vector store from the same directory
const loadedVectorStore = await HNSWLib.load(directory, new OpenAIEmbeddings());

await loadedVectorStore.delete({ directory });
