import { Document } from "@langchain/core/documents";
import type { BrowserbaseLoadOptions } from "@browserbasehq/sdk";
import { BaseDocumentLoader } from "../base.js";
import type { DocumentLoader } from "../base.js";

type BrowserbaseLoaderOptions = BrowserbaseLoadOptions & {
  apiKey?: string;
};

/**
 * Load pre-rendered web pages using a headless browser hosted on Browserbase.
 *
 * Depends on `@browserbasehq/sdk` package.
 * Get your API key from https://browserbase.com
 *
 * @param {string[]} urls - The URLs of the web pages to load.
 * @param {BrowserbaseLoaderOptions} [options] - Browserbase client options.
 */

export class BrowserbaseLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  urls: string[];

  options: BrowserbaseLoaderOptions;

  constructor(urls: string[], options: BrowserbaseLoaderOptions = {}) {
    super();
    this.urls = urls;
    this.options = options;
  }

  /**
   * Load pages from URLs.
   *
   * @returns {Promise<Document[]>} - A generator that yields loaded documents.
   */

  async load(): Promise<Document[]> {
    const documents: Document[] = [];
    for await (const doc of this.lazyLoad()) {
      documents.push(doc);
    }

    return documents;
  }

  /**
   * Load pages from URLs.
   *
   * @returns {Generator<Document>} - A generator that yields loaded documents.
   */
  async *lazyLoad() {
    const browserbase = await BrowserbaseLoader.imports(this.options.apiKey);
    const pages = await browserbase.loadURLs(this.urls, this.options);

    let index = 0;
    for await (const page of pages) {
      yield new Document({
        pageContent: page,
        metadata: {
          url: this.urls[index],
        },
      });

      index += index + 1;
    }
  }

  static async imports(apiKey?: string) {
    try {
      const { default: Browserbase } = await import("@browserbasehq/sdk");
      return new Browserbase(apiKey);
    } catch (error) {
      throw new Error(
        "You must run " +
          "`npm install --save @browserbasehq/sdk` " +
          "to use the Browserbase loader."
      );
    }
  }
}
