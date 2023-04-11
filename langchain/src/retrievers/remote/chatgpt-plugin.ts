import { Document } from "../../document.js";
import {
  RemoteRetriever,
  RemoteRetrieverParams,
  RemoteRetrieverValues,
} from "./base.js";

interface ChatGPTPluginRetrieverFilter {
  document_id?: string;
  source?: string;
  source_id?: string;
  author?: string;
  start_date?: string;
  end_date?: string;
}

interface ChatGPTPluginRetrieverParams extends RemoteRetrieverParams {
  /**
   * The number of results to request from the ChatGPTRetrievalPlugin server
   */
  topK?: number;

  /**
   * The filter to use when querying the ChatGPTRetrievalPlugin server
   */
  filter?: ChatGPTPluginRetrieverFilter;
}

export class ChatGPTPluginRetriever
  extends RemoteRetriever
  implements ChatGPTPluginRetrieverParams
{
  topK: number;

  filter?: ChatGPTPluginRetrieverFilter;

  constructor({ topK = 4, filter, ...rest }: ChatGPTPluginRetrieverParams) {
    super(rest);
    this.topK = topK;
    this.filter = filter;
  }

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
