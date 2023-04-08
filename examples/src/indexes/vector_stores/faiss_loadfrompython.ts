import { FaissStore } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";

export const run = async () => {
  // Save the vector store to a directory
  const directory = "faiss_index";

  // Load the vector store from the same directory
  const loadedVectorStore = await FaissStore.loadFormPython(
    directory,
    new OpenAIEmbeddings()
  );

  // vectorStore and loadedVectorStore are identical

  const result = await loadedVectorStore.similaritySearch("test", 2);
  console.log("result", result);
};
