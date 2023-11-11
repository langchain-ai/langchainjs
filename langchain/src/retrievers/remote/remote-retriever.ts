import { Document } from "../../document.js";
import {
  RemoteRetriever,
  RemoteRetrieverParams,
  RemoteRetrieverValues,
} from "./base.js";

export interface RemoteLangChainRetrieverParams extends RemoteRetrieverParams {
  /**
   * The key in the JSON body to put the query in
   */
  inputKey?: string;
  /**
   * The key in the JSON response to get the response from
   */
  responseKey?: string;
  /**
   * The key in the JSON response to get the page content from
   */
  pageContentKey?: string;
  /**
   * The key in the JSON response to get the metadata from
   */
  metadataKey?: string;
}

/**
 * Specific implementation of the `RemoteRetriever` class designed to
 * retrieve documents from a remote source using a JSON-based API. It
 * implements the `RemoteLangChainRetrieverParams` interface which defines
 * the keys used to interact with the JSON API.
 */
export class RemoteLangChainRetriever
  extends RemoteRetriever
  implements RemoteLangChainRetrieverParams
{
  lc_namespace = ["langchain", "retrievers", "remote", "remote-retriever"];

  inputKey: string;

  responseKey: string;

  pageContentKey: string;

  metadataKey: string;

  constructor({
    inputKey = "message",
    responseKey = "response",
    pageContentKey = "page_content",
    metadataKey = "metadata",
    ...rest
  }: RemoteLangChainRetrieverParams) {
    super(rest);
    this.inputKey = inputKey;
    this.responseKey = responseKey;
    this.pageContentKey = pageContentKey;
    this.metadataKey = metadataKey;
  }

  /**
   * Creates the JSON body of the request sent to the API. The `inputKey` is
   * set to the query.
   * @param query Query string to be sent to the API.
   * @returns An object with the `inputKey` set to the query.
   */
  createJsonBody(query: string): RemoteRetrieverValues {
    return {
      [this.inputKey]: query,
    };
  }

  /**
   * Processes the JSON response from the API. It returns an array of
   * `Document` objects, each created with the page content and metadata
   * extracted from the response using the `pageContentKey` and
   * `metadataKey`, respectively.
   * @param json JSON response from the API.
   * @returns An array of `Document` objects.
   */
  processJsonResponse(json: RemoteRetrieverValues): Document[] {
    return json[this.responseKey].map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) =>
        new Document({
          pageContent: r[this.pageContentKey],
          metadata: r[this.metadataKey],
        })
    );
  }
}
