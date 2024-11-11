import {
  AsyncCaller,
} from "@langchain/core/utils/async_caller";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import { Document } from "@langchain/core/documents";
import { WebBaseLoaderParams, WebBaseLoader } from "./web_base_loader.js";

export class HTMLWebBaseLoader extends BaseDocumentLoader implements WebBaseLoader {
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