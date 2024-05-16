/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { SpiderLoader } from "../web/spider.js";

test("Test SpiderLoader load method with scrape mode", async () => {
  const loader = new SpiderLoader({
    url: "https://spider.cloud",
    apiKey: process.env.SPIDER_API_KEY,
    mode: "scrape",
  });

  const documents = await loader.load();
  expect(documents).toHaveLength(1);
  const document = documents[0];
  expect(document).toBeInstanceOf(Document);
  expect(document.pageContent).toBeTruthy();
  expect(document.metadata).toBeTruthy();
});

test("Test SpiderLoader load method with crawl mode", async () => {
  const loader = new SpiderLoader({
    url: "https://spider.cloud",
    apiKey: process.env.SPIDER_API_KEY,
    mode: "crawl",
  });

  const documents = await loader.load();
  const document = documents[0];
  expect(document).toBeInstanceOf(Document);
  expect(document.pageContent).toBeTruthy();
  expect(document.metadata).toBeTruthy();
}, 15000);
