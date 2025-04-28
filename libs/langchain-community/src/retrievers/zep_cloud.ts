import { ZepClient } from "@getzep/zep-cloud";
import {
  SearchScope,
  SearchType,
  MemorySearchResult,
  NotFoundError,
} from "@getzep/zep-cloud/api";
import { BaseRetriever, BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";

/**
 * Configuration interface for the ZepRetriever class. Extends the
 * BaseRetrieverInput interface.
 *
 * @argument {string} sessionId - The ID of the Zep session.
 * @argument {string} [apiKey] - The Zep Cloud Project Key.
 * @argument {number} [topK] - The number of results to return.
 * @argument [searchScope] [searchScope] - The scope of the search: "messages" or "summary".
 * @argument [searchType] [searchType] - The type of search to perform: "similarity" or "mmr".
 * @argument {number} [mmrLambda] - The lambda value for the MMR search.
 * @argument {Record<string, unknown>} [filter] - The metadata filter to apply to the search.
 */
export interface ZepCloudRetrieverConfig extends BaseRetrieverInput {
  sessionId: string;
  topK?: number;
  apiKey: string;
  searchScope?: SearchScope;
  searchType?: SearchType;
  mmrLambda?: number;
  filter?: Record<string, unknown>;
}

/**
 * Class for retrieving information from a Zep Cloud long-term memory store.
 * Extends the BaseRetriever class.
 * @example
 * ```typescript
 * const retriever = new ZepCloudRetriever({
 *   apiKey: "<zep cloud project api key>",
 *   sessionId: "session_exampleUUID",
 *   topK: 3,
 * });
 * const query = "Can I drive red cars in France?";
 * const docs = await retriever.getRelevantDocuments(query);
 * ```
 */
export class ZepCloudRetriever extends BaseRetriever {
  static lc_name() {
    return "ZepRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "zep"];

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "ZEP_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return { apiKey: "api_key" };
  }

  client: ZepClient;

  private sessionId: string;

  private topK?: number;

  private searchScope?: SearchScope;

  private searchType?: SearchType;

  private mmrLambda?: number;

  private filter?: Record<string, unknown>;

  constructor(config: ZepCloudRetrieverConfig) {
    super(config);
    this.sessionId = config.sessionId;
    this.topK = config.topK;
    this.searchScope = config.searchScope;
    this.searchType = config.searchType;
    this.mmrLambda = config.mmrLambda;
    this.filter = config.filter;
    this.client = new ZepClient({ apiKey: config.apiKey });
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
          score,
          ...rest
        }) =>
          new Document({
            pageContent: content ?? "",
            metadata: { score, ...messageMetadata, ...rest },
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
          score,
          ...rest
        }) =>
          new Document({
            pageContent: content ?? "",
            metadata: { score, ...summaryMetadata, ...rest },
          })
      );
  }

  /**
   *  Retrieves the relevant documents based on the given query.
   *  @param {string} query - The query string.
   *  @returns {Promise<Document[]>} A promise that resolves to an array of relevant Document objects.
   */
  async _getRelevantDocuments(query: string): Promise<Document[]> {
    try {
      const results: MemorySearchResult[] = await this.client.memory.search(
        this.sessionId,
        {
          text: query,
          metadata: this.filter,
          searchScope: this.searchScope,
          searchType: this.searchType,
          mmrLambda: this.mmrLambda,
          limit: this.topK,
        }
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
