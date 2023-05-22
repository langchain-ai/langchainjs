/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";

import { ZepRetriever } from "../zep.js";

test("ZepRetriever", async () => {
  const baseURL = process.env.ZEP_API_URL || "localhost:8000";
  const sessionID = "your-session-id"; // Replace with the actual session ID
  const topN = 3; // The number of documents to retrieve
  const zepRetriever = new ZepRetriever(sessionID, baseURL, topN);

  const docs = await zepRetriever.getRelevantDocuments("hello");

  expect(docs.length).toBeGreaterThan(0);

  console.log(docs);
});
