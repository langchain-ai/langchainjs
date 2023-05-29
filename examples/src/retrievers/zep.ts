/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ZepRetriever } from "langchain/retrievers/zep";
// import { ZepClient, Memory, Message } from "@getzep/zep-js";

export const run = async () => {
  const url = process.env.ZEP_URL || "http://localhost:8000";
  const sessionID = "TestSession1232";
  console.log(`Session ID: ${sessionID}, URL: ${url}`);

  const retriever = new ZepRetriever(sessionID, url);

  const query = "hello";
  const docs = await retriever.getRelevantDocuments(query);

  console.log(docs);
};
