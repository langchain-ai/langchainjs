import { Document } from "../document.js";
import { BaseRetriever } from "../schema/index.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";

interface ChatGPTPluginRetrieverFilter {
  document_id?: string;
  source?: string;
  source_id?: string;
  author?: string;
  start_date?: string;
  end_date?: string;
}

type ChatGPTPluginRetrieverAuth = false | { bearer: string };

interface ChatGPTPluginRetrieverParams extends AsyncCallerParams {
  /**
   * The URL of the ChatGPTRetrievalPlugin server
   */
  url: string;

  /**
   * The authentication method to use, currently implemented is
   * - false: no authentication
   * - { bearer: string }: Bearer token authentication
   */
  auth: ChatGPTPluginRetrieverAuth;

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
  extends BaseRetriever
  implements ChatGPTPluginRetrieverParams
{
  url: string;

  auth: ChatGPTPluginRetrieverAuth;

  topK: number;

  filter?: ChatGPTPluginRetrieverFilter;

  asyncCaller: AsyncCaller;

  constructor({
    url,
    auth,
    topK = 4,
    filter,
    ...rest
  }: ChatGPTPluginRetrieverParams) {
    super();

    this.url = url;
    this.auth = auth;
    this.topK = topK;
    this.asyncCaller = new AsyncCaller(rest);
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    const res = await this.asyncCaller.call(fetch, `${this.url}/query`, {
      method: "POST",
      body: JSON.stringify({
        queries: [
          {
            query,
            top_k: this.topK,
            filter: this.filter,
          },
        ],
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(this.auth && this.auth.bearer
          ? { Authorization: `Bearer ${this.auth.bearer}` }
          : {}),
      },
    });

    if (!res.ok) {
      throw new Error(`Error calling ChatGPTPluginRetriever: ${res.status}`);
    }

    const body = await res.json();
    const results = body?.results?.[0]?.results;

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
