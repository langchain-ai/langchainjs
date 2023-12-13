import {
  MemorySearchPayload,
  MemorySearchResult,
  NotFoundError,
  ZepClient,
} from "@getzep/zep-js";
import { BaseRetriever, BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";

/**
 * Configuration interface for the ZepRetriever class. Extends the
 * BaseRetrieverInput interface.
 *
 * @argument {string} sessionId - The ID of the Zep session.
 * @argument {string} url - The URL of the Zep API.
 * @argument {number} [topK] - The number of results to return.
 * @argument {string} [apiKey] - The API key for the Zep API.
 * @argument [searchScope] [searchScope] - The scope of the search: "messages" or "summary".
 * @argument [searchType] [searchType] - The type of search to perform: "similarity" or "mmr".
 * @argument {number} [mmrLambda] - The lambda value for the MMR search.
 * @argument {Record<string, unknown>} [filter] - The metadata filter to apply to the search.
 */
export interface ZepRetrieverConfig extends BaseRetrieverInput {
  sessionId: string;
  url: string;
  topK?: number;
  apiKey?: string;
  searchScope?: "messages" | "summary";
  searchType?: "similarity" | "mmr";
  mmrLambda?: number;
  filter?: Record<string, unknown>;
}

/**
 * Class for retrieving information from a Zep long-term memory store.
 * Extends the BaseRetriever class.
 * @example
 * ```typescript
 * const retriever = new ZepRetriever({
 *   url: "http:
 *   sessionId: "session_exampleUUID",
 *   topK: 3,
 * });
 * const query = "Can I drive red cars in France?";
 * const docs = await retriever.getRelevantDocuments(query);
 * ```
 */
export class ZepRetriever extends BaseRetriever {
  static lc_name() {
    return "ZepRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "zep"];

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "ZEP_API_KEY",
      url: "ZEP_API_URL",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return { apiKey: "api_key" };
  }

  zepClientPromise: Promise<ZepClient>;

  private sessionId: string;

  private topK?: number;

  private searchScope?: "messages" | "summary";

  private searchType?: "similarity" | "mmr";

  private mmrLambda?: number;

  private filter?: Record<string, unknown>;

  constructor(config: ZepRetrieverConfig) {
    super(config);
    this.sessionId = config.sessionId;
    this.topK = config.topK;
    this.searchScope = config.searchScope;
    this.searchType = config.searchType;
    this.mmrLambda = config.mmrLambda;
    this.filter = config.filter;
    this.zepClientPromise = ZepClient.init(config.url, config.apiKey);
  }

  /**
   *  Converts an array of message search results to an array of Document objects.
   *  @param {MemorySearchResult[]} results - The array of search results.
   *  @returns {Document[]} An array of Document objects representing the search results.
   */
  private searchMessageResultToDoc(results: MemorySearchResult[]): Document[] {
    return results
      .filter((r) => r.message)
      .map(
        ({
          message: { content, metadata: messageMetadata } = {},
          dist,
          ...rest
        }) =>
          new Document({
            pageContent: content ?? "",
            metadata: { score: dist, ...messageMetadata, ...rest },
          })
      );
  }

  /**
   *  Converts an array of summary search results to an array of Document objects.
   *  @param {MemorySearchResult[]} results - The array of search results.
   *  @returns {Document[]} An array of Document objects representing the search results.
   */
  private searchSummaryResultToDoc(results: MemorySearchResult[]): Document[] {
    return results
      .filter((r) => r.summary)
      .map(
        ({
          summary: { content, metadata: summaryMetadata } = {},
          dist,
          ...rest
        }) =>
          new Document({
            pageContent: content ?? "",
            metadata: { score: dist, ...summaryMetadata, ...rest },
          })
      );
  }

  /**
   *  Retrieves the relevant documents based on the given query.
   *  @param {string} query - The query string.
   *  @returns {Promise<Document[]>} A promise that resolves to an array of relevant Document objects.
   */
  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const payload: MemorySearchPayload = {
      text: query,
      metadata: this.filter,
      search_scope: this.searchScope,
      search_type: this.searchType,
      mmr_lambda: this.mmrLambda,
    };
    // Wait for ZepClient to be initialized
    const zepClient = await this.zepClientPromise;
    if (!zepClient) {
      throw new Error("ZepClient is not initialized");
    }
    try {
      const results: MemorySearchResult[] = await zepClient.memory.searchMemory(
        this.sessionId,
        payload,
        this.topK
      );
      return this.searchScope === "summary"
        ? this.searchSummaryResultToDoc(results)
        : this.searchMessageResultToDoc(results);
    } catch (error) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (error instanceof NotFoundError) {
        return Promise.resolve([]); // Return an empty Document array
      }
      // If it's not a NotFoundError, throw the error again
      throw error;
    }
  }
}
