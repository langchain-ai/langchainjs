import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";

export const run = async () => {
  const loader = new PuppeteerWebBaseLoader("https://www.tabnews.com.br/");

  /**  Loader use evaluate function ` await page.evaluate(() => document.body.innerHTML);` as default evaluate */
  const docs = await loader.load();
  console.log({ docs });

  const loaderWithOptions = new PuppeteerWebBaseLoader(
    "https://www.tabnews.com.br/",
    {
      launchOptions: {
        headless: true,
      },
      gotoOptions: {
        waitUntil: "domcontentloaded",
      },
      /**  Pass custom evaluate , in this case you get page and browser instances */
      async evaluate(page, browser) {
        await page.waitForResponse("https://www.tabnews.com.br/va/view");

        const result = await page.evaluate(() => document.body.innerHTML);
        await browser.close();
        return result;
      },
    }
  );
  const docsFromLoaderWithOptions = await loaderWithOptions.load();
  console.log({ docsFromLoaderWithOptions });
};
