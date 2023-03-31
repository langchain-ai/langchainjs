import { Document } from "../document.js";
import { BaseRetriever } from "../schema/index.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";

interface RemoteRetrieverParams extends AsyncCallerParams {
  url: string;

  auth?: Record<string, string>;

  inputKey?: string;
  responseKey?: string;
  pageContentKey?: string;
  metadataKey?: string;
}

export class RemoteLangChainRetriever extends BaseRetriever {
  url: string;

  auth?: Record<string, string>;

  inputKey: string;

  responseKey: string;

  asyncCaller: AsyncCaller;

  pageContentKey: string;

  metadataKey: string;

  constructor({
    url,
    auth = undefined,
    inputKey = "message",
    responseKey = "response",
    pageContentKey = "page_content",
    metadataKey = "metadata",
    ...rest
  }: RemoteRetrieverParams) {
    super();
    this.url = url;
    this.auth = auth;
    this.inputKey = inputKey;
    this.responseKey = responseKey;
    this.pageContentKey = pageContentKey;
    this.metadataKey = metadataKey;
    this.asyncCaller = new AsyncCaller(rest);
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    const res = await this.asyncCaller.call(fetch, this.url, {
      method: "POST",
      body: JSON.stringify({
        [this.inputKey]: query,
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(this.auth ? this.auth : {}),
      },
    });

    if (!res.ok) {
      throw new Error(
        `Error calling RemoteLangChainRetriever: ${res.status}: ${res.statusText}`
      );
    }

    const body = await res.json();
    return body[this.responseKey].map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) =>
        new Document({
          pageContent: r[this.pageContentKey],
          metadata: r[this.metadataKey],
        })
    );
  }
}
