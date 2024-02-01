import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";

const loaderWithOptions = new PuppeteerWebBaseLoader("https://langchain.com", {
  launchOptions: {
    headless: true,
  },
  gotoOptions: {
    waitUntil: "domcontentloaded",
  },
});
const screenshot = await loaderWithOptions.screenshot();
console.log({ screenshot });
