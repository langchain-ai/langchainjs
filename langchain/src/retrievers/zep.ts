import {
  MemorySearchPayload,
  MemorySearchResult,
  NotFoundError,
  ZepClient,
} from "@getzep/zep-js";
import { BaseRetriever, BaseRetrieverInput } from "../schema/retriever.js";
import { Document } from "../document.js";

export interface ZepRetrieverConfig extends BaseRetrieverInput {
  sessionId: string;
  url: string;
  topK?: number;
  apiKey?: string;
}

export class ZepRetriever extends BaseRetriever {
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

  private zepClient: ZepClient;

  private sessionId: string;

  private topK?: number;

  constructor(config: ZepRetrieverConfig) {
    super(config);
    this.zepClient = new ZepClient(config.url, config.apiKey);
    this.sessionId = config.sessionId;
    this.topK = config.topK;
  }

  /**
   *  Converts an array of search results to an array of Document objects.
   *  @param {MemorySearchResult[]} results - The array of search results.
   *  @returns {Document[]} An array of Document objects representing the search results.
   */
  private searchResultToDoc(results: MemorySearchResult[]): Document[] {
    return results
      .filter((r) => r.message)
      .map(
        ({ message: { content } = {}, ...metadata }, dist) =>
          new Document({
            pageContent: content ?? "",
            metadata: { score: dist, ...metadata },
          })
      );
  }

  /**
   *  Retrieves the relevant documents based on the given query.
   *  @param {string} query - The query string.
   *  @returns {Promise<Document[]>} A promise that resolves to an array of relevant Document objects.
   */
  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const payload: MemorySearchPayload = { text: query, metadata: {} };
    try {
      const results: MemorySearchResult[] = await this.zepClient.searchMemory(
        this.sessionId,
        payload,
        this.topK
      );

      return this.searchResultToDoc(results);
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
