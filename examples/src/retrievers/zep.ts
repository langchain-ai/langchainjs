import { ZepRetriever } from "langchain/retrievers/zep";

export const run = async () => {
  const url = process.env.ZEP_URL || "http://localhost:8000";
  const sessionId = "TestSession1232";
  console.log(`Session ID: ${sessionId}, URL: ${url}`);

  const retriever = new ZepRetriever({ sessionId, url });

  const query = "hello";
  const docs = await retriever.getRelevantDocuments(query);

  console.log(docs);
};
