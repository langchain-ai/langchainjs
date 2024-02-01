import Exa, {
  ContentsOptions,
  RegularSearchOptions,
  SearchResponse,
  SearchResult,
} from "exa-js";

import { BaseRetriever, BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";

/**
 * Interface for the fields required during the initialization of a
 * `ExaRetriever` instance. It extends the `BaseRetrieverInput`
 * interface and adds a `client` field of type `Exa`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ExaRetrieverFields<T extends ContentsOptions = any>
  extends BaseRetrieverInput {
  client: Exa.default;
  searchArgs?: RegularSearchOptions & T;
}

export function _getMetadata<T extends ContentsOptions>(result: SearchResult<T>): Record<string, unknown> {
  const newMetadata: Record<string, unknown> = { ...result };
  delete newMetadata.text;
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
export class ExaRetriever<
  T extends ContentsOptions = { highlights: true }
> extends BaseRetriever {
  static lc_name() {
    return "ExaRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "exa"];

  private client: Exa.default;

  searchArgs?: RegularSearchOptions & T;

  constructor(fields: ExaRetrieverFields<T>) {
    super(fields);

    this.client = fields.client;
    this.searchArgs = fields.searchArgs;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const res: SearchResponse<T> = await this.client.searchAndContents<T>(
      query,
      this.searchArgs
    );

    const documents: Document[] = [];
    for (const result of res.results) {
      documents.push(
        new Document({
          pageContent: "text" in result ? result.text : "",
          metadata: _getMetadata<T>(result),
        })
      );
    }
    return documents;
  }
}
