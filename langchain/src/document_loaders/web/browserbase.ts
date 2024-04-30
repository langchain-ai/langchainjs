import { Document, DocumentInterface } from "@langchain/core/documents";
import Browserbase, { BrowserbaseLoadOptions } from "@browserbasehq/sdk";
import { BaseDocumentLoader } from "../base.js";
import type { DocumentLoader } from "../base.js";

interface BrowserbaseLoaderOptions extends BrowserbaseLoadOptions {
  apiKey?: string;
}

/**
 * Load pre-rendered web pages using a headless browser hosted on Browserbase.
 *
 * Depends on `@browserbasehq/sdk` package.
 * Get your API key from https://browserbase.com
 *
 * @example
 * ```javascript
 * import { BrowserbaseLoader } from "langchain/document_loaders/web/browserbase.js";
 *
 * const loader = new BrowserbaseLoader(["https://example.com"], {
 *   apiKey: process.env.BROWSERBASE_API_KEY,
 *   textContent: true,
 * });
 *
 * const docs = await loader.load();
 * ```
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

  browserbase: Browserbase;

  constructor(urls: string[], options: BrowserbaseLoaderOptions = {}) {
    super();
    this.urls = urls;
    this.options = options;
    this.browserbase = new Browserbase(options.apiKey);
  }

  /**
   * Load pages from URLs.
   *
   * @returns {Promise<DocumentInterface[]>} - A promise which resolves to a list of documents.
   */

  async load(): Promise<DocumentInterface[]> {
    const documents: Document[] = [];
    for await (const doc of this.lazyLoad()) {
      documents.push(doc);
    }

    return documents;
  }

  /**
   * Load pages from URLs.
   *
   * @returns {Generator<DocumentInterface>} - A generator that yields documents.
   */
  async *lazyLoad() {
    const pages = await this.browserbase.loadURLs(this.urls, this.options);

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
}
