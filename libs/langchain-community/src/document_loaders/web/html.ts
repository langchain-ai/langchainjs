import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import { Document } from "@langchain/core/documents";
import type { DocumentLoader } from "@langchain/core/document_loaders/base";

/**
 * Represents the parameters for configuring WebBaseLoaders. It extends the
 * AsyncCallerParams interface and adds additional parameters specific to
 * web-based loaders.
 */
export interface WebBaseLoaderParams extends AsyncCallerParams {
  /**
   * The timeout in milliseconds for the fetch request. Defaults to 10s.
   */
  timeout?: number;

  /**
   * The text decoder to use to decode the response. Defaults to UTF-8.
   */
  textDecoder?: TextDecoder;
  /**
   * The headers to use in the fetch request.
   */
  headers?: HeadersInit;
  /**
   * The selector to use to extract the text from the document.
   * Defaults to "body".
   * @deprecated Use CheerioWebBaseLoaderParams from @langchain/community/document_loaders/web/cheerio
   * instead.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selector?: any;
}

export interface WebBaseLoader extends DocumentLoader {
  timeout: number;

  caller: AsyncCaller;

  textDecoder?: TextDecoder;

  headers?: HeadersInit;
}

export class HTMLWebBaseLoader
  extends BaseDocumentLoader
  implements WebBaseLoader
{
  timeout: number;

  caller: AsyncCaller;

  textDecoder?: TextDecoder;

  headers?: HeadersInit;

  constructor(public webPath: string, fields?: WebBaseLoaderParams) {
    super();
    const { timeout, textDecoder, headers, ...rest } = fields ?? {};
    this.timeout = timeout ?? 10000;
    this.caller = new AsyncCaller(rest);
    this.textDecoder = textDecoder;
    this.headers = headers;
  }

  async load(): Promise<Document[]> {
    const response = await this.caller.call(fetch, this.webPath, {
      signal: this.timeout ? AbortSignal.timeout(this.timeout) : undefined,
      headers: this.headers,
    });

    const html =
      this.textDecoder?.decode(await response.arrayBuffer()) ??
      (await response.text());

    return [new Document({ pageContent: html })];
  }
}
