import { expect, test } from "@jest/globals";
import { PlaywrightWebBaseLoader } from "../web/playwright.js";

test("Test playwright web scraper loader", async () => {
  const loader = new PlaywrightWebBaseLoader("https://www.google.com/");
  const result = await loader.load();

  expect(result).toBeDefined();
  expect(result.length).toBe(1);
}, 20_000);

test("Test playwright web scraper loader with evaluate options", async () => {
  let nrTimesCalled = 0;
  const loader = new PlaywrightWebBaseLoader("https://www.google.com/", {
    launchOptions: {
      headless: true,
    },
    gotoOptions: {
      waitUntil: "domcontentloaded",
    },
    async evaluate(page) {
      nrTimesCalled += 1;
      return page.content();
    },
  });
  const result = await loader.load();

  expect(nrTimesCalled).toBe(1);
  expect(result).toBeDefined();
  expect(result.length).toBe(1);
}, 20_000);
