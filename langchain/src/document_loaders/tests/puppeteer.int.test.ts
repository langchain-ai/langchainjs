import { expect, test } from "@jest/globals";
import { PuppeteerWebBaseLoader } from "../web/puppeteer.js";

test.skip("Test puppeteer web scraper loader", async () => {
  const loader = new PuppeteerWebBaseLoader("https://www.google.com/");
  const result = await loader.load();

  expect(result).toBeDefined();
  expect(result.length).toBe(1);
}, 20_000);

test.skip("Test puppeteer web scraper loader with evaluate options", async () => {
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

test.skip("Test puppeteer web scraper can screenshot page", async () => {
  const loader = new PuppeteerWebBaseLoader("https://langchain.com/", {
    launchOptions: {
      headless: true,
      ignoreDefaultArgs: ["--disable-extensions"],
    },
    gotoOptions: {
      waitUntil: "domcontentloaded",
    },
  });
  const screenshotDocument = await loader.screenshot();

  expect(screenshotDocument.metadata.source).toBe("https://langchain.com/");
  // verify screenshotDocument.pageContent is a base64 encoded string
  expect(screenshotDocument.pageContent).toMatch(
    /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/
  );
  // Uncomment if you want to write the screenshot to a file
  // await fs.writeFile("langchain.png", screenshotDocument.pageContent, {
  //   encoding: "base64",
  // });
}, 20_000);
