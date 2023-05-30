import { ZepClient, SearchResult, SearchPayload } from "@getzep/zep-js";
import { BaseRetriever } from "../schema/index.js";
import { Document } from "../document.js";

export type ZepRetrieverConfig = {
  sessionId: string;
  url: string;
  topK?: number;
};

export class ZepRetriever extends BaseRetriever {
  private zepClient: ZepClient;

  private sessionId: string;

  private topK?: number;

  constructor(config: ZepRetrieverConfig) {
    super();
    this.zepClient = new ZepClient(config.url);
    this.sessionId = config.sessionId;
    this.topK = config.topK;
  }

  /**
   *  Converts an array of search results to an array of Document objects.
   *  @param {SearchResult[]} results - The array of search results.
   *  @returns {Document[]} An array of Document objects representing the search results.
   */
  private searchResultToDoc(results: SearchResult[]): Document[] {
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
  async getRelevantDocuments(query: string): Promise<Document[]> {
    const payload: SearchPayload = { text: query, meta: {} };
    const results: SearchResult[] = await this.zepClient.searchMemory(
      this.sessionId,
      payload,
      this.topK
    );

    return this.searchResultToDoc(results);
  }
}
