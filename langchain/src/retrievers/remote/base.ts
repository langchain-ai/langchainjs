import { BaseRetriever, BaseRetrieverInput } from "../../schema/retriever.js";
import { AsyncCaller, AsyncCallerParams } from "../../util/async_caller.js";
import { Document } from "../../document.js";

export type RemoteRetrieverAuth = false | { bearer: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RemoteRetrieverValues = Record<string, any>;

export interface RemoteRetrieverParams
  extends AsyncCallerParams,
    BaseRetrieverInput {
  /**
   * The URL of the remote retriever server
   */
  url: string;

  /**
   * The authentication method to use, currently implemented is
   * - false: no authentication
   * - { bearer: string }: Bearer token authentication
   */
  auth: RemoteRetrieverAuth;
}

export abstract class RemoteRetriever
  extends BaseRetriever
  implements RemoteRetrieverParams
{
  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      "auth.bearer": "REMOTE_RETRIEVER_AUTH_BEARER",
    };
  }

  url: string;

  auth: RemoteRetrieverAuth;

  headers: Record<string, string>;

  asyncCaller: AsyncCaller;

  constructor(fields: RemoteRetrieverParams) {
    super(fields);
    const { url, auth, ...rest } = fields;
    this.url = url;
    this.auth = auth;
    this.headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(this.auth && this.auth.bearer
        ? { Authorization: `Bearer ${this.auth.bearer}` }
        : {}),
    };
    this.asyncCaller = new AsyncCaller(rest);
  }

  abstract createJsonBody(query: string): RemoteRetrieverValues;

  abstract processJsonResponse(json: RemoteRetrieverValues): Document[];

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const body = this.createJsonBody(query);
    const response = await this.asyncCaller.call(() =>
      fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body),
      })
    );
    if (!response.ok) {
      throw new Error(
        `Failed to retrieve documents from ${this.url}: ${response.status} ${response.statusText}`
      );
    }
    const json = await response.json();
    return this.processJsonResponse(json);
  }
}
