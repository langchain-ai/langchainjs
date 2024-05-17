import type {
  CheerioAPI,
  CheerioOptions,
  load as LoadT,
  SelectorType,
} from "cheerio";
import { Document } from "@langchain/core/documents";
import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import { BaseDocumentLoader } from "../base.js";
import type { DocumentLoader } from "../base.js";
import { logVersion020MigrationWarning } from "../../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion020MigrationWarning({
  oldEntrypointName: "document_loaders/web/cheerio",
  newPackageName: "@langchain/community",
});

/**
 * @deprecated - Import from "@langchain/community/document_loaders/web/cheerio" instead. This entrypoint will be removed in 0.3.0.
 *
 * Represents the parameters for configuring the CheerioWebBaseLoader. It
 * extends the AsyncCallerParams interface and adds additional parameters
 * specific to web-based loaders.
 */
export interface WebBaseLoaderParams extends AsyncCallerParams {
  /**
   * The timeout in milliseconds for the fetch request. Defaults to 10s.
   */
  timeout?: number;

  /**
   * The selector to use to extract the text from the document. Defaults to
   * "body".
   */
  selector?: SelectorType;

  /**
   * The text decoder to use to decode the response. Defaults to UTF-8.
   */
  textDecoder?: TextDecoder;
}

/**
 * @deprecated - Import from "@langchain/community/document_loaders/web/cheerio" instead. This entrypoint will be removed in 0.3.0.
 *
 * A class that extends the BaseDocumentLoader and implements the
 * DocumentLoader interface. It represents a document loader for loading
 * web-based documents using Cheerio.
 * @example
 * ```typescript
 * const loader = new CheerioWebBaseLoader("https:exampleurl.com");
 * const docs = await loader.load();
 * console.log({ docs });
 * ```
 */
export class CheerioWebBaseLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  timeout: number;

  caller: AsyncCaller;

  selector?: SelectorType;

  textDecoder?: TextDecoder;

  constructor(public webPath: string, fields?: WebBaseLoaderParams) {
    super();
    const { timeout, selector, textDecoder, ...rest } = fields ?? {};
    this.timeout = timeout ?? 10000;
    this.caller = new AsyncCaller(rest);
    this.selector = selector ?? "body";
    this.textDecoder = textDecoder;
  }

  /**
   * Fetches web documents from the given array of URLs and loads them using Cheerio.
   * It returns an array of CheerioAPI instances.
   * @param urls An array of URLs to fetch and load.
   * @returns A Promise that resolves to an array of CheerioAPI instances.
   */
  static async scrapeAll(
    urls: string[],
    caller: AsyncCaller,
    timeout: number | undefined,
    textDecoder?: TextDecoder,
    options?: CheerioOptions
  ): Promise<CheerioAPI[]> {
    return Promise.all(
      urls.map((url) =>
        CheerioWebBaseLoader._scrape(url, caller, timeout, textDecoder, options)
      )
    );
  }

  static async _scrape(
    url: string,
    caller: AsyncCaller,
    timeout: number | undefined,
    textDecoder?: TextDecoder,
    options?: CheerioOptions
  ): Promise<CheerioAPI> {
    const { load } = await CheerioWebBaseLoader.imports();
    const response = await caller.call(fetch, url, {
      signal: timeout ? AbortSignal.timeout(timeout) : undefined,
    });
    const html =
      textDecoder?.decode(await response.arrayBuffer()) ??
      (await response.text());
    return load(html, options);
  }

  /**
   * Fetches the web document from the webPath and loads it using Cheerio.
   * It returns a CheerioAPI instance.
   * @returns A Promise that resolves to a CheerioAPI instance.
   */
  async scrape(): Promise<CheerioAPI> {
    return CheerioWebBaseLoader._scrape(
      this.webPath,
      this.caller,
      this.timeout,
      this.textDecoder
    );
  }

  /**
   * Extracts the text content from the loaded document using the selector
   * and creates a Document instance with the extracted text and metadata.
   * It returns an array of Document instances.
   * @returns A Promise that resolves to an array of Document instances.
   */
  async load(): Promise<Document[]> {
    const $ = await this.scrape();
    const text = $(this.selector).text();
    const metadata = { source: this.webPath };
    return [new Document({ pageContent: text, metadata })];
  }

  /**
   * A static method that dynamically imports the Cheerio library and
   * returns the load function. If the import fails, it throws an error.
   * @returns A Promise that resolves to an object containing the load function from the Cheerio library.
   */
  static async imports(): Promise<{
    load: typeof LoadT;
  }> {
    try {
      const { load } = await import("cheerio");
      return { load };
    } catch (e) {
      console.error(e);
      throw new Error(
        "Please install cheerio as a dependency with, e.g. `yarn add cheerio`"
      );
    }
  }
}
