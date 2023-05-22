/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ZepClient } from "@getzep/zep-js";
import { ZepRetriever } from "langchain/retrievers/zep";

export const run = async () => {
  const url = process.env.ZEP_URL || "http://localhost:8000";

  const sessionId = 'TESTSESSION'; // Session ID

  const zepClient = new ZepClient(url);
  const retriever = new ZepRetriever(sessionId, url);

  const query = "hello";
  const docs = await retriever.getRelevantDocuments(query);

  console.log(docs);
};
