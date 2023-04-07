import { expect, test } from "@jest/globals";
import { PuppeteerWebBaseLoader } from "../web/puppeteer_web_base.js";

test("Test puppeteer web scraper loader", async () => {
  const loader = new PuppeteerWebBaseLoader("https://www.google.com/");
  const result = await loader.load();

  expect(result).toBeDefined();
  expect(result.length).toBe(1);
}, 20_000);

test("Test puppeteer web scraper loader with evaluate options", async () => {
  let nrTimesCalled = 0;
  const loader = new PuppeteerWebBaseLoader("https://www.google.com/", {
    launchOptions: {
      headless: true,
      ignoreDefaultArgs: ["--disable-extensions"],
    },
    gotoOptions: {
      waitUntil: "domcontentloaded",
    },
    async evaluate(page) {
      nrTimesCalled += 1;
      return page.evaluate(() => document.body.innerHTML);
    },
  });
  const result = await loader.load();

  expect(nrTimesCalled).toBe(1);
  expect(result).toBeDefined();
  expect(result.length).toBe(1);
}, 20_000);
