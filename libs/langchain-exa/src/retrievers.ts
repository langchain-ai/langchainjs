import Exa, {
  RegularSearchOptions,
  SearchResponse,
  SearchResult,
  TextContentsOptions,
} from "exa-js";

import { BaseRetriever, BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";

/**
 * Interface for the fields required during the initialization of a
 * `ExaRetriever` instance. It extends the `BaseRetrieverInput`
 * interface and adds a `client` field of type `Exa`.
 */
export interface ExaRetrieverFields extends BaseRetrieverInput {
  client: Exa;
  searchArgs?: RegularSearchOptions;
}

export function _getMetadata(result: SearchResult): Record<string, unknown> {
  const newMetadata = result;
  if ("text" in newMetadata) {
    delete newMetadata.text;
  }
  return newMetadata;
}

/**
 * @example
 * ```typescript
 * const retriever = new ExaRetriever({
 *   client: new Exa(
 *     process.env.EXA_API_KEY,
 *     process.env.EXA_BASE_URL,
 *   ),
 * });
 * const docs = await retriever.getRelevantDocuments("hello");
 * ```
 */
export class ExaRetriever extends BaseRetriever {
  static lc_name() {
    return "ExaRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "exa"];

  private client: Exa;

  searchArgs?: RegularSearchOptions;

  constructor(fields: ExaRetrieverFields) {
    super(fields);

    this.client = fields.client;
    this.searchArgs = fields.searchArgs;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const res: SearchResponse<{ text: TextContentsOptions }> =
      await this.client.searchAndContents(query, this.searchArgs);

    const documents: Document[] = [];
    for (const result of res.results) {
      documents.push(
        new Document({
          pageContent: result.text ?? "",
          metadata: _getMetadata(result),
        })
      );
    }
    return documents;
  }
}
