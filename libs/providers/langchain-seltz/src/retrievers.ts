import { Seltz, type SearchOptions } from "seltz";
import type { SearchResponse } from "seltz";

import { BaseRetriever, BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";

/**
 * Interface for the fields required during the initialization of a
 * `SeltzRetriever` instance. It extends the `BaseRetrieverInput`
 * interface and adds a `client` field of type `Seltz`.
 */
export interface SeltzRetrieverFields extends BaseRetrieverInput {
  client: Seltz;
  searchArgs?: SearchOptions;
}

/**
 * Extracts metadata from a Seltz document result, excluding the content field
 * which is used as the page content.
 */
export function _getMetadata(
  result: SearchResponse["documents"][number]
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  if (result.url) {
    metadata.url = result.url;
  }
  return metadata;
}

/**
 * Seltz web knowledge retriever integration.
 *
 * Seltz provides fast, up-to-date web data with context-engineered
 * web content and sources for real-time AI reasoning.
 *
 * @example
 * ```typescript
 * import { SeltzRetriever } from "@langchain/seltz";
 * import { Seltz } from "seltz";
 *
 * const retriever = new SeltzRetriever({
 *   client: new Seltz({ apiKey: process.env.SELTZ_API_KEY }),
 * });
 * const docs = await retriever.getRelevantDocuments("machine learning basics");
 * ```
 */
export class SeltzRetriever extends BaseRetriever {
  static lc_name() {
    return "SeltzRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "seltz"];

  private client: Seltz;

  searchArgs?: SearchOptions;

  constructor(fields: SeltzRetrieverFields) {
    super(fields);

    this.client = fields.client;
    this.searchArgs = fields.searchArgs;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const res: SearchResponse = await this.client.search(
      query,
      this.searchArgs
    );

    const documents: Document[] = [];
    for (const result of res.documents) {
      const pageContent = result.content ?? "No content available.";

      documents.push(
        new Document({
          pageContent,
          metadata: _getMetadata(result),
        })
      );
    }
    return documents;
  }
}
