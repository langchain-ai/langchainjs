/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import FirecrawlApp from "@mendable/firecrawl-js";

import { FirecrawlRetriever } from "../firecrawl.js";

test("FirecrawlRetriever", async () => {
  const client = new FirecrawlApp({
    apiKey: process.env.FIRECRAWL_API_KEY!,
  });
  const retriever = new FirecrawlRetriever({ client });

  const docs = await retriever.getRelevantDocuments("hello");

  expect(docs.length).toBeGreaterThan(0);

  console.log(docs);
});
