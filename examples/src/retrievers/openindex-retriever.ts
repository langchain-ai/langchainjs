import { ChatGPTPluginRetriever } from "langchain/retrievers/remote";

export const run = async () => {
  const apiKey = process.env?.OPENINDEX_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenIndex API key not set. You can set it as OPENINDEX_API_KEY in your .env file, or pass it to OpenIndex."
    );
  }

  const retriever = new ChatGPTPluginRetriever({
    url: "https://retriever.openindex.ai",
    auth: {
      bearer: apiKey,
    },
  });

  const docs = await retriever.getRelevantDocuments("hello world");

  console.log(docs);
};
