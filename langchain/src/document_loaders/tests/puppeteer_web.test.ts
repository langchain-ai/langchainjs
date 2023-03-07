import { expect, test } from "@jest/globals";
import { PuppeteerWebBaseLoader } from "../puppeteer_web_base.js";

test("Test puppeteer web scraper loader", async () => {
  const loader = new PuppeteerWebBaseLoader("https://www.tabnews.com.br/");
  await loader.load();
}, 20_000);

test("Test puppeteer web scraper loader with evaluate options", async () => {
  const loader = new PuppeteerWebBaseLoader("https://www.tabnews.com.br/", {
    launchOptions: {
      headless: true,
      ignoreDefaultArgs: ["--disable-extensions"],
    },
    gotoOptions: {
      waitUntil: "domcontentloaded",
    },
    async evaluate(page, browser) {
      const firstResponse = await page.waitForResponse(
        "https://www.tabnews.com.br/va/view"
      );

      expect(firstResponse.ok()).toBe(true);
      const result = await page.evaluate(() => document.body.innerHTML);
      await browser.close();
      return result;
    },
  });
  const result = await loader.load();

  expect(result).toBeDefined();
  expect(result.length).toBe(1);
  expect(result[0].pageContent).toContain("TabNews");
}, 20_000);
