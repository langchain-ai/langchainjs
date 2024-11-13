import type {
  CheerioAPI,
  CheerioOptions,
  load as LoadT,
  SelectorType,
} from "cheerio";
import { Document } from "@langchain/core/documents";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import type { WebBaseLoaderParams, WebBaseLoader } from "./html.js";

/**
 * @deprecated Either import the CheerioWebBaseLoaderParams from @langchain/community/document_loaders/web/cheerio
 * or use the WebBaseLoaderParams from @langchain/community/document_loaders/web/html.
 */
export { WebBaseLoaderParams };

/**
 * Represents the parameters for configuring the CheerioWebBaseLoader. It
 * extends the WebBaseLoaderParams interface and adds additional parameters
 * specific to loading with Cheerio.
 */
export interface CheerioWebBaseLoaderParams extends WebBaseLoaderParams {
  /**
   * The selector to use to extract the text from the document. Defaults to
   * "body".
   */
  selector?: SelectorType;
}

/**
 * A class that extends the BaseDocumentLoader and implements the
 * DocumentLoader interface. It represents a document loader for loading
 * web-based documents using Cheerio.
 * @example
 * ```typescript
 * const loader = new CheerioWebBaseLoader("https://exampleurl.com");
 * const docs = await loader.load();
 * console.log({ docs });
 * ```
 */
export class CheerioWebBaseLoader
  extends BaseDocumentLoader
  implements WebBaseLoader
{
  timeout: number;

  caller: AsyncCaller;

  selector?: SelectorType;

  textDecoder?: TextDecoder;

  headers?: HeadersInit;

  constructor(public webPath: string, fields?: CheerioWebBaseLoaderParams) {
    super();
    const { timeout, selector, textDecoder, headers, ...rest } = fields ?? {};
    this.timeout = timeout ?? 10000;
    this.caller = new AsyncCaller(rest);
    this.selector = selector ?? "body";
    this.textDecoder = textDecoder;
    this.headers = headers;
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
    options?: CheerioOptions & {
      headers?: HeadersInit;
    }
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
    options?: CheerioOptions & {
      headers?: HeadersInit;
    }
  ): Promise<CheerioAPI> {
    const { headers, ...cheerioOptions } = options ?? {};
    const { load } = await CheerioWebBaseLoader.imports();
    const response = await caller.call(fetch, url, {
      signal: timeout ? AbortSignal.timeout(timeout) : undefined,
      headers,
    });
    const html =
      textDecoder?.decode(await response.arrayBuffer()) ??
      (await response.text());
    return load(html, cheerioOptions);
  }

  /**
   * Fetches the web document from the webPath and loads it using Cheerio.
   * It returns a CheerioAPI instance.
   * @returns A Promise that resolves to a CheerioAPI instance.
   */
  async scrape(): Promise<CheerioAPI> {
    const options = { headers: this.headers };
    return CheerioWebBaseLoader._scrape(
      this.webPath,
      this.caller,
      this.timeout,
      this.textDecoder,
      options
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
