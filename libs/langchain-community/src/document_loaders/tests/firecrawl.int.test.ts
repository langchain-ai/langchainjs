/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { FireCrawlLoader } from "../web/firecrawl.js";

test("Test FireCrawlLoader load method with scrape mode", async () => {
  const loader = new FireCrawlLoader({
    url: "https://firecrawl.dev",
    apiKey: process.env.FIRECRAWL_API_KEY,
    mode: "scrape",
  });

  const documents = await loader.load();
  expect(documents).toHaveLength(1);
  const document = documents[0];
  expect(document).toBeInstanceOf(Document);
  expect(document.pageContent).toBeTruthy();
  expect(document.metadata).toBeTruthy();
});

test("Test FireCrawlLoader load method with crawl mode", async () => {
  const loader = new FireCrawlLoader({
    url: "https://firecrawl.dev",
    apiKey: process.env.FIRECRAWL_API_KEY,
    mode: "crawl",
  });

  const documents = await loader.load();
  const document = documents[0];
  expect(document).toBeInstanceOf(Document);
  expect(document.pageContent).toBeTruthy();
  expect(document.metadata).toBeTruthy();
}, 15000);
