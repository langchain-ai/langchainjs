import { HNSWLib } from "langchain/vectorstores/hnswlib";

export const run = async () => {
  // Delete the vector store.
  const directory = "your/directory/here";
  await HNSWLib.delete(directory);
};
