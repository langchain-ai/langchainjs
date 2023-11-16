import { BaseRetriever, BaseRetrieverInput } from "../../schema/retriever.js";
import { AsyncCaller, AsyncCallerParams } from "../../util/async_caller.js";
import { Document } from "../../document.js";

/**
 * Type for the authentication method used by the RemoteRetriever. It can
 * either be false (no authentication) or an object with a bearer token.
 */
export type RemoteRetrieverAuth = false | { bearer: string };

/**
 * Type for the JSON response values from the remote server.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RemoteRetrieverValues = Record<string, any>;

/**
 * Interface for the parameters required to initialize a RemoteRetriever
 * instance.
 */
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

/**
 * Abstract class for interacting with a remote server to retrieve
 * relevant documents based on a given query.
 */
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

  /**
   * Abstract method that should be implemented by subclasses to create the
   * JSON body of the request based on the given query.
   * @param query The query based on which the JSON body of the request is created.
   * @returns The JSON body of the request.
   */
  abstract createJsonBody(query: string): RemoteRetrieverValues;

  /**
   * Abstract method that should be implemented by subclasses to process the
   * JSON response from the server and convert it into an array of Document
   * instances.
   * @param json The JSON response from the server.
   * @returns An array of Document instances.
   */
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
