import type { LaunchOptions, Page, Browser } from "playwright";

import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";
import type { DocumentLoader } from "../base.js";

export { Page, Browser };

export type PlaywrightGotoOptions = {
  referer?: string;
  timeout?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
};

export type PlaywrightEvaluate = (
  page: Page,
  browser: Browser
) => Promise<string>;

export type PlaywrightWebBaseLoaderOptions = {
  launchOptions?: LaunchOptions;
  gotoOptions?: PlaywrightGotoOptions;
  evaluate?: PlaywrightEvaluate;
};

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

    await page.goto(url, {
      timeout: 180000,
      waitUntil: "domcontentloaded",
      ...options?.gotoOptions,
    });
    const bodyHTML = options?.evaluate
      ? await options?.evaluate(page, browser)
      : await page.content();

    await browser.close();

    return bodyHTML;
  }

  async scrape(): Promise<string> {
    return PlaywrightWebBaseLoader._scrape(this.webPath, this.options);
  }

  async load(): Promise<Document[]> {
    const text = await this.scrape();

    const metadata = { source: this.webPath };
    return [new Document({ pageContent: text, metadata })];
  }

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
