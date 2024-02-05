import {
  BaseRetriever,
  type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import type { DriaParams, SearchOptions as DriaSearchOptions } from "dria";
import { Dria } from "dria";

/**
 * Configurations for Dria retriever.
 *
 * - `contractId`: a Dria knowledge's contract ID.
 * - `apiKey`: a Dria API key; if omitted, the retriever will check for `DRIA_API_KEY` environment variable.
 *
 * The retrieval can be configured with the following options:
 *
 * - `topK`: number of results to return, max 20. (default: 10)
 * - `rerank`: re-rank the results from most to least semantically relevant to the given search query. (default: true)
 * - `level`: level of detail for the search, must be an integer from 0 to 5 (inclusive). (default: 1)
 * - `field`: CSV field name, only relevant for the CSV files.
 */
export interface DriaRetrieverArgs
  extends DriaParams,
    BaseRetrieverInput,
    DriaSearchOptions {}

/**
 * Class for retrieving documents from knowledge uploaded to Dria.
 *
 * @example
 * ```typescript
 * // contract of TypeScript Handbook v4.9 uploaded to Dria
 * const contractId = "-B64DjhUtCwBdXSpsRytlRQCu-bie-vSTvTIT8Ap3g0";
 * const retriever = new DriaRetriever({ contractId });
 *
 * const docs = await retriever.getRelevantDocuments("What is a union type?");
 * console.log(docs);
 * ```
 */
export class DriaRetriever extends BaseRetriever {
  static lc_name() {
    return "DriaRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "dria"];

  get lc_secrets() {
    return { apiKey: "DRIA_API_KEY" };
  }

  get lc_aliases() {
    return { apiKey: "api_key" };
  }

  apiKey: string;

  public driaClient: Dria;

  private searchOptions: DriaSearchOptions;

  constructor(fields: DriaRetrieverArgs) {
    super(fields);

    const apiKey = fields.apiKey ?? getEnvironmentVariable("DRIA_API_KEY");
    if (!apiKey) throw new Error("Missing DRIA_API_KEY.");
    this.apiKey = apiKey;

    this.searchOptions = {
      topK: fields.topK,
      field: fields.field,
      rerank: fields.rerank,
      level: fields.level,
    };

    this.driaClient = new Dria({
      contractId: fields.contractId,
      apiKey: this.apiKey,
    });
  }

  /**
   * Currently connected knowledge on Dria.
   *
   * Retriever will use this contract ID while retrieving documents,
   * and will throw an error if `undefined`.
   *
   * In the case that this is `undefined`, the user is expected to
   * set contract ID manually, such as after creating a new knowledge & inserting
   * data there with the Dria client.
   */
  get contractId(): string | undefined {
    return this.driaClient.contractId;
  }

  set contractId(value: string) {
    this.driaClient.contractId = value;
  }

  /**
   * Retrieves documents from Dria with respect to the configured contract ID, based on
   * the given query string.
   *
   * @param query The query string
   * @returns  A promise that resolves to an array of documents, with page content as text,
   * along with `id` and the relevance `score` within the metadata.
   */
  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const docs = await this.driaClient.search(query, this.searchOptions);
    return docs.map(
      (d) =>
        new Document({
          // dria.search returns a string within the metadata as the content
          pageContent: d.metadata,
          metadata: {
            id: d.id,
            score: d.score,
          },
        })
    );
  }
}
