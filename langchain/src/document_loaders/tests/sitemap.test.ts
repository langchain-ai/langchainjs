import { test } from '@jest/globals';
import { SitemapLoader } from '../web/sitemap.js';

test("SitemapLoader", async () => {
  const loader = new SitemapLoader("https://js.langchain.com", {
    maxRetries: 1,
    maxConcurrency: 100,
  });

  const docs = await loader.load();
  console.log({ docs: docs.length });
})