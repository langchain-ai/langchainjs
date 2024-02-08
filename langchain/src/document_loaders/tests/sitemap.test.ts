import { test } from "@jest/globals";
import { SitemapLoader } from "../web/sitemap.js";

test("SitemapLoader", async () => {
  const loader = new SitemapLoader("https://www.langchain.com/sitemap.xml");

  const docs = await loader.load();
  expect(docs.length).toBeGreaterThan(0);
});
