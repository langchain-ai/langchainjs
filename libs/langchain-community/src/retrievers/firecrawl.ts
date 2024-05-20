import FirecrawlApp from "@mendable/firecrawl-js";
import { BaseRetriever, BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";

/**
 * Interface for the fields required during the initialization of a
 * `FirecrawlRetriever` instance. It extends the `BaseRetrieverInput`
 * interface and adds a `client` field of type `FirecrawlApp`.
 */
export interface FirecrawlRetrieverFields extends BaseRetrieverInput {
  client: FirecrawlApp;
  searchArgs?: Record<string, unknown>;
}

/**
 * @example
 * ```typescript
 * const retriever = new FirecrawlRetriever({
 *   client: new FirecrawlApp({
 *     apiKey: process.env.FIRECRAWL_API_KEY,
 *   }),
 * });
 * const docs = await retriever.getRelevantDocuments("hello");
 * ```
 */
export class FirecrawlRetriever extends BaseRetriever {
  static lc_name() {
    return "FirecrawlRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "firecrawl"];

  private client: FirecrawlApp;

  searchArgs?: Record<string, unknown>;

  constructor(fields: FirecrawlRetrieverFields) {
    super(fields);

    this.client = fields.client;
    this.searchArgs = fields.searchArgs;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const res = await this.client.search(query, this.searchArgs);

    const documents: Document[] = [];
    for (const result of res.data) {
      let pageContent;
      if ("markdown" in result) {
        pageContent = result.markdown;
      } else {
        pageContent = "No results found.";
      }

      documents.push(
        new Document({
          pageContent,
          metadata: result.metadata
        })
      );
    }
    return documents;
  }
}