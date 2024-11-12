import { expect, test } from "@jest/globals";
import { HTMLWebBaseLoader } from "../web/html.js";

test("Test HTML web scraper loader", async () => {
  const loader = new HTMLWebBaseLoader(
    "https://news.ycombinator.com/item?id=34817881"
  );
  const docs = await loader.load();
  expect(docs[0].pageContent).toEqual(
    expect.stringContaining("What Lights the Universe’s Standard Candles?")
  );
});

test("Test HTML web scraper loader with textDecoder", async () => {
  const loader = new HTMLWebBaseLoader(
    "https://corp.163.com/gb/about/management.html",
    {
      textDecoder: new TextDecoder("gbk"),
    }
  );

  const docs = await loader.load();
  expect(docs[0].pageContent.trim()).toEqual(expect.stringContaining("网易"));
});
