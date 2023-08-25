import type { LaunchOptions, Page, Browser, Response } from "playwright";

import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";
import type { DocumentLoader } from "../base.js";

export { Page, Browser, Response };

export type PlaywrightGotoOptions = {
  referer?: string;
  timeout?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
};

/**
 * Type representing a function for evaluating JavaScript code on a web
 * page using Playwright. Takes a Page, Browser, and Response object as
 * parameters and returns a Promise that resolves to a string.
 */
export type PlaywrightEvaluate = (
  page: Page,
  browser: Browser,
  response: Response | null
) => Promise<string>;

export type PlaywrightWebBaseLoaderOptions = {
  launchOptions?: LaunchOptions;
  gotoOptions?: PlaywrightGotoOptions;
  evaluate?: PlaywrightEvaluate;
};

/**
 * Class representing a document loader for scraping web pages using
 * Playwright. Extends the BaseDocumentLoader class and implements the
 * DocumentLoader interface.
 */
export class PlaywrightWebBaseLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  options: PlaywrightWebBaseLoaderOptions | undefined;

  constructor(
    public webPath: string,
    options?: PlaywrightWebBaseLoaderOptions
  ) {
    super();
    this.options = options ?? undefined;
  }

  static async _scrape(
    url: string,
    options?: PlaywrightWebBaseLoaderOptions
  ): Promise<string> {
    const { chromium } = await PlaywrightWebBaseLoader.imports();

    const browser = await chromium.launch({
      headless: true,
      ...options?.launchOptions,
    });
    const page = await browser.newPage();

    const response = await page.goto(url, {
      timeout: 180000,
      waitUntil: "domcontentloaded",
      ...options?.gotoOptions,
    });
    const bodyHTML = options?.evaluate
      ? await options?.evaluate(page, browser, response)
      : await page.content();

    await browser.close();

    return bodyHTML;
  }

  /**
   * Method that calls the _scrape method to perform the scraping of the web
   * page specified by the webPath property. Returns a Promise that resolves
   * to the scraped HTML content of the web page.
   * @returns Promise that resolves to the scraped HTML content of the web page.
   */
  async scrape(): Promise<string> {
    return PlaywrightWebBaseLoader._scrape(this.webPath, this.options);
  }

  /**
   * Method that calls the scrape method and returns the scraped HTML
   * content as a Document object. Returns a Promise that resolves to an
   * array of Document objects.
   * @returns Promise that resolves to an array of Document objects.
   */
  async load(): Promise<Document[]> {
    const text = await this.scrape();

    const metadata = { source: this.webPath };
    return [new Document({ pageContent: text, metadata })];
  }

  /**
   * Static method that imports the necessary Playwright modules. Returns a
   * Promise that resolves to an object containing the imported modules.
   * @returns Promise that resolves to an object containing the imported modules.
   */
  static async imports(): Promise<{
    chromium: typeof import("playwright").chromium;
  }> {
    try {
      const { chromium } = await import("playwright");

      return { chromium };
    } catch (e) {
      console.error(e);
      throw new Error(
        "Please install playwright as a dependency with, e.g. `yarn add playwright`"
      );
    }
  }
}
