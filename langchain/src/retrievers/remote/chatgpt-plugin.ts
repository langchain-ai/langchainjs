import { Document } from "../../document.js";
import {
  RemoteRetriever,
  RemoteRetrieverParams,
  RemoteRetrieverValues,
} from "./base.js";

/**
 * Interface for the filter parameters used when querying the
 * ChatGPTRetrievalPlugin server.
 */
export interface ChatGPTPluginRetrieverFilter {
  document_id?: string;
  source?: string;
  source_id?: string;
  author?: string;
  start_date?: string;
  end_date?: string;
}

export interface ChatGPTPluginRetrieverParams extends RemoteRetrieverParams {
  /**
   * The number of results to request from the ChatGPTRetrievalPlugin server
   */
  topK?: number;

  /**
   * The filter to use when querying the ChatGPTRetrievalPlugin server
   */
  filter?: ChatGPTPluginRetrieverFilter;
}

/**
 * Class that connects ChatGPT to third-party applications via plugins. It
 * extends the RemoteRetriever class and implements the
 * ChatGPTPluginRetrieverParams interface.
 * @example
 * ```typescript
 * const retriever = new ChatGPTPluginRetriever({
 *   url: "http:
 *   auth: {
 *     bearer: "super-secret-jwt-token-with-at-least-32-characters-long",
 *   },
 * });
 * const docs = await retriever.getRelevantDocuments("hello world");
 * ```
 */
export class ChatGPTPluginRetriever
  extends RemoteRetriever
  implements ChatGPTPluginRetrieverParams
{
  lc_namespace = ["langchain", "retrievers", "remote", "chatgpt-plugin"];

  topK: number;

  filter?: ChatGPTPluginRetrieverFilter;

  constructor({ topK = 4, filter, ...rest }: ChatGPTPluginRetrieverParams) {
    super(rest);
    this.topK = topK;
    this.filter = filter;
  }

  /**
   * Creates a JSON body for the request to the ChatGPTRetrievalPlugin
   * server.
   * @param query The query to send to the server.
   * @returns A JSON object representing the body of the request.
   */
  createJsonBody(query: string): RemoteRetrieverValues {
    return {
      queries: [
        {
          query,
          top_k: this.topK,
          filter: this.filter,
        },
      ],
    };
  }

  /**
   * Processes the JSON response from the ChatGPTRetrievalPlugin server and
   * returns an array of Document instances.
   * @param json The JSON response from the server.
   * @returns An array of Document instances.
   */
  processJsonResponse(json: RemoteRetrieverValues): Document[] {
    const results = json?.results?.[0]?.results;

    if (!results) {
      // Note an empty array of results would not fall into this case
      throw new Error("No results returned from ChatGPTPluginRetriever");
    }

    return results.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result: any) =>
        new Document({
          pageContent: result.text,
          metadata: result.metadata,
        })
    );
  }
}
