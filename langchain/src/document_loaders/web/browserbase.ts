import { Document, type DocumentInterface } from "@langchain/core/documents";
import Browserbase, { LoadOptions, ClientOptions } from "@browserbasehq/sdk";
import { BaseDocumentLoader } from "../base.js";
import type { DocumentLoader } from "../base.js";
import { logVersion020MigrationWarning } from "../../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion020MigrationWarning({
  oldEntrypointName: "document_loaders/web/browserbase",
  newPackageName: "@langchain/community",
});

type BrowserbaseLoaderOptions = ClientOptions & LoadOptions;

/**
 * @deprecated Import from "@langchain/community/document_loaders/web/browserbase" instead. This entrypoint will be removed in 0.3.0.
 * Load pre-rendered web pages using a headless browser hosted on Browserbase.
 *
 * Depends on `@browserbasehq/sdk` package.
 * Get your API key from https://browserbase.com
 *
 * @example
 * ```typescript
 * import { BrowserbaseLoader } from "langchain/document_loaders/web/browserbase";
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
    this.browserbase = new Browserbase(options);
  }

  /**
   * Load pages from URLs.
   *
   * @returns {Promise<DocumentInterface[]>} - A promise which resolves to a list of documents.
   */
  async load(): Promise<DocumentInterface[]> {
    const documents: DocumentInterface[] = [];
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
