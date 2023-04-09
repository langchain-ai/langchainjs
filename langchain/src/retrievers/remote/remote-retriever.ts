import { Document } from "../../document.js";
import {
  RemoteRetriever,
  RemoteRetrieverParams,
  RemoteRetrieverValues,
} from "./base.js";

interface RemoteLangChainRetrieverParams extends RemoteRetrieverParams {
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

export class RemoteLangChainRetriever
  extends RemoteRetriever
  implements RemoteLangChainRetrieverParams
{
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

  createJsonBody(query: string): RemoteRetrieverValues {
    return {
      [this.inputKey]: query,
    };
  }

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
