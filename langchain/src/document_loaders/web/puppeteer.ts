import type {
  launch,
  WaitForOptions,
  Page,
  Browser,
  PuppeteerLaunchOptions,
} from "puppeteer";

import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";
import type { DocumentLoader } from "../base.js";

export { Page, Browser };

export type PuppeteerGotoOptions = WaitForOptions & {
  referer?: string;
  referrerPolicy?: string;
};

/**
 * Type representing a function for evaluating JavaScript code on a web
 * page using Puppeteer. It takes a Page and Browser object as parameters
 * and returns a Promise that resolves to a string.
 */
export type PuppeteerEvaluate = (
  page: Page,
  browser: Browser
) => Promise<string>;

export type PuppeteerWebBaseLoaderOptions = {
  launchOptions?: PuppeteerLaunchOptions;
  gotoOptions?: PuppeteerGotoOptions;
  evaluate?: PuppeteerEvaluate;
};

/**
 * Class that extends the BaseDocumentLoader class and implements the
 * DocumentLoader interface. It represents a document loader for scraping
 * web pages using Puppeteer.
 * @example
 * ```typescript
 * const loader = new PuppeteerWebBaseLoader("https:exampleurl.com", {
 *   launchOptions: {
 *     headless: true,
 *   },
 *   gotoOptions: {
 *     waitUntil: "domcontentloaded",
 *   },
 * });
 * const screenshot = await loader.screenshot();
 * ```
 */
export class PuppeteerWebBaseLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  options: PuppeteerWebBaseLoaderOptions | undefined;

  constructor(public webPath: string, options?: PuppeteerWebBaseLoaderOptions) {
    super();
    this.options = options ?? undefined;
  }

  static async _scrape(
    url: string,
    options?: PuppeteerWebBaseLoaderOptions
  ): Promise<string> {
    const { launch } = await PuppeteerWebBaseLoader.imports();

    const browser = await launch({
      headless: true,
      defaultViewport: null,
      ignoreDefaultArgs: ["--disable-extensions"],
      ...options?.launchOptions,
    });
    const page = await browser.newPage();

    await page.goto(url, {
      timeout: 180000,
      waitUntil: "domcontentloaded",
      ...options?.gotoOptions,
    });
    const bodyHTML = options?.evaluate
      ? await options?.evaluate(page, browser)
      : await page.evaluate(() => document.body.innerHTML);

    await browser.close();

    return bodyHTML;
  }

  /**
   * Method that calls the _scrape method to perform the scraping of the web
   * page specified by the webPath property.
   * @returns Promise that resolves to the scraped HTML content of the web page.
   */
  async scrape(): Promise<string> {
    return PuppeteerWebBaseLoader._scrape(this.webPath, this.options);
  }

  /**
   * Method that calls the scrape method and returns the scraped HTML
   * content as a Document object.
   * @returns Promise that resolves to an array of Document objects.
   */
  async load(): Promise<Document[]> {
    const text = await this.scrape();

    const metadata = { source: this.webPath };
    return [new Document({ pageContent: text, metadata })];
  }

  /**
   * Static class method used to screenshot a web page and return
   * it as a {@link Document} object where  the pageContent property
   * is the screenshot encoded in base64.
   *
   * @param {string} url
   * @param {PuppeteerWebBaseLoaderOptions} options
   * @returns {Document} A document object containing the screenshot of the page encoded in base64.
   */
  static async _screenshot(
    url: string,
    options?: PuppeteerWebBaseLoaderOptions
  ): Promise<Document> {
    const { launch } = await PuppeteerWebBaseLoader.imports();

    const browser = await launch({
      headless: true,
      defaultViewport: null,
      ignoreDefaultArgs: ["--disable-extensions"],
      ...options?.launchOptions,
    });
    const page = await browser.newPage();

    await page.goto(url, {
      timeout: 180000,
      waitUntil: "domcontentloaded",
      ...options?.gotoOptions,
    });
    const screenshot = await page.screenshot();
    const base64 = screenshot.toString("base64");
    const metadata = { source: url };
    return new Document({ pageContent: base64, metadata });
  }

  /**
   * Screenshot a web page and return it as a {@link Document} object where
   * the pageContent property is the screenshot encoded in base64.
   *
   * @returns {Promise<Document>} A document object containing the screenshot of the page encoded in base64.
   */
  async screenshot(): Promise<Document> {
    return PuppeteerWebBaseLoader._screenshot(this.webPath, this.options);
  }

  /**
   * Static method that imports the necessary Puppeteer modules. It returns
   * a Promise that resolves to an object containing the imported modules.
   * @returns Promise that resolves to an object containing the imported Puppeteer modules.
   */
  static async imports(): Promise<{
    launch: typeof launch;
  }> {
    try {
      // eslint-disable-next-line import/no-extraneous-dependencies
      const { launch } = await import("puppeteer");

      return { launch };
    } catch (e) {
      console.error(e);
      throw new Error(
        "Please install puppeteer as a dependency with, e.g. `yarn add puppeteer`"
      );
    }
  }
}
