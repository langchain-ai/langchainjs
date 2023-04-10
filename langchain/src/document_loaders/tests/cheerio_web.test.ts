import { expect, test } from "@jest/globals";
import { CheerioWebBaseLoader } from "../cheerio_web_base.js";

test("Test cheerio web scraper loader", async () => {
  const loader = new CheerioWebBaseLoader(
    "https://news.ycombinator.com/item?id=34817881"
  );
  await loader.load();
});

test("Test cheerio web scraper loader with selector", async () => {
  const loader = new CheerioWebBaseLoader("https://about.google/commitments/");
  const selectH1 = "h1";
  const doc = await loader.load(selectH1);
  expect(doc[0].pageContent.trim()).toBe(
    "Committed to significantly improving the lives of as many people as possible."
  );
});
