import type { CheerioAPI, load as LoadT, SelectorType } from "cheerio";
import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";
import type { DocumentLoader } from "../base.js";
import { AsyncCaller, AsyncCallerParams } from "../../util/async_caller.js";

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

  static async _scrape(
    url: string,
    caller: AsyncCaller,
    timeout: number | undefined,
    textDecoder?: TextDecoder
  ): Promise<CheerioAPI> {
    const { load } = await CheerioWebBaseLoader.imports();
    const response = await caller.call(fetch, url, {
      signal: timeout ? AbortSignal.timeout(timeout) : undefined,
    });

    const html =
      textDecoder?.decode(await response.arrayBuffer()) ??
      (await response.text());
    return load(html);
  }

  async scrape(): Promise<CheerioAPI> {
    return CheerioWebBaseLoader._scrape(
      this.webPath,
      this.caller,
      this.timeout,
      this.textDecoder
    );
  }

  async load(): Promise<Document[]> {
    const $ = await this.scrape();
    const text = $(this.selector).text();
    const metadata = { source: this.webPath };
    return [new Document({ pageContent: text, metadata })];
  }

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
