import Exa, {
  ContentsOptions,
  RegularSearchOptions,
  SearchResponse,
  SearchResult,
} from "exa-js";

import { BaseRetriever, BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

import { createExaClient, normalizeSearchArgs } from "./utils.js";

/**
 * Interface for the fields required during the initialization of a
 * `ExaRetriever` instance. It extends the `BaseRetrieverInput`
 * interface and adds a `client` field of type `Exa`.
 */
export interface ExaRetrieverFields<
  T extends ContentsOptions = { text: true },
> extends BaseRetrieverInput {
  client?: Exa;
  searchArgs?: RegularSearchOptions & T;
}

export function _getMetadata<T extends ContentsOptions = { text: true }>(
  result: SearchResult<T>
): Record<string, unknown> {
  const newMetadata: Record<string, unknown> = { ...result };
  delete newMetadata.text;
  return newMetadata;
}

/**
 * @example
 * ```typescript
 * const retriever = new ExaRetriever();
 * const docs = await retriever.getRelevantDocuments("hello");
 * ```
 */
export class ExaRetriever<
  T extends ContentsOptions = { text: true },
> extends BaseRetriever {
  static lc_name() {
    return "ExaRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "exa"];

  private client: Exa;

  searchArgs?: RegularSearchOptions & T;

  constructor(fields: ExaRetrieverFields<T> = {}) {
    super(fields);

    this.client =
      fields.client ?? createExaClient(getEnvironmentVariable("EXA_API_KEY"));
    this.searchArgs = fields.searchArgs;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const res: SearchResponse<T> = await this.client.search(
      query,
      normalizeSearchArgs(this.searchArgs) as RegularSearchOptions & {
        contents: T;
      }
    );

    const documents: Document[] = [];
    for (const result of res.results) {
      let pageContent;
      if ("text" in result) {
        pageContent = result.text ?? "";
      } else if ("highlights" in result) {
        pageContent = result.highlights.join("\n\n");
      } else {
        pageContent = "No results found.";
      }

      documents.push(
        new Document({
          pageContent,
          metadata: _getMetadata<T>(result),
        })
      );
    }
    return documents;
  }
}
