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

export type PuppeteerEvaluate = (
  page: Page,
  browser: Browser
) => Promise<string>;

export type PuppeteerWebBaseLoaderOptions = {
  launchOptions?: PuppeteerLaunchOptions;
  gotoOptions?: PuppeteerGotoOptions;
  evaluate?: PuppeteerEvaluate;
};

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

  async scrape(): Promise<string> {
    return PuppeteerWebBaseLoader._scrape(this.webPath, this.options);
  }

  async load(): Promise<Document[]> {
    const text = await this.scrape();

    const metadata = { source: this.webPath };
    return [new Document({ pageContent: text, metadata })];
  }

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
