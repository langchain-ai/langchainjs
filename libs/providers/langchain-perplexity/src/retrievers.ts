import {
  BaseRetriever,
  type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Recency filters supported by the Perplexity Search API.
 */
export type PerplexitySearchRecencyFilter = "day" | "week" | "month" | "year";

/**
 * A single search result returned by the Perplexity Search API.
 */
export interface PerplexitySearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string | null;
  last_updated?: string | null;
}

/**
 * Raw response shape returned by `POST https://api.perplexity.ai/search`.
 */
export interface PerplexitySearchResponse {
  id?: string;
  results: PerplexitySearchResult[];
}

/**
 * Constructor fields for {@link PerplexitySearchRetriever}.
 */
export interface PerplexitySearchRetrieverFields extends BaseRetrieverInput {
  /** Maximum number of results to return (1-20). Defaults to 10. */
  k?: number;

  /** Maximum total tokens across all results. Defaults to 25000. */
  maxTokens?: number;

  /** Maximum tokens per page. Defaults to 1024. */
  maxTokensPerPage?: number;

  /** ISO country code (e.g. "US"). */
  country?: string;

  /** Domain filter (max 20). */
  searchDomainFilter?: string[];

  /** Time-based filter for results. */
  searchRecencyFilter?: PerplexitySearchRecencyFilter;

  /** Only include content published after this date (format: %m/%d/%Y). */
  searchAfterDate?: string;

  /** Only include content published before this date (format: %m/%d/%Y). */
  searchBeforeDate?: string;

  /**
   * Perplexity API key. Defaults to the `PERPLEXITY_API_KEY` or
   * `PPLX_API_KEY` environment variable.
   */
  apiKey?: string;
}

/**
 * Body sent to the Perplexity `/search` endpoint.
 *
 * @internal
 */
export interface PerplexitySearchRequestBody {
  query: string;
  max_results?: number;
  max_tokens?: number;
  max_tokens_per_page?: number;
  country?: string;
  search_domain_filter?: string[];
  search_recency_filter?: PerplexitySearchRecencyFilter;
  search_after_date?: string;
  search_before_date?: string;
}

const PERPLEXITY_SEARCH_URL = "https://api.perplexity.ai/search";

/**
 * Retriever that calls the Perplexity Search API.
 *
 * @example
 * ```typescript
 * import { PerplexitySearchRetriever } from "@langchain/perplexity";
 *
 * const retriever = new PerplexitySearchRetriever({
 *   k: 5,
 *   searchRecencyFilter: "week",
 * });
 *
 * const docs = await retriever.invoke("Latest LLM benchmarks");
 * ```
 */
export class PerplexitySearchRetriever extends BaseRetriever {
  static lc_name() {
    return "PerplexitySearchRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "perplexity"];

  k: number;

  maxTokens: number;

  maxTokensPerPage: number;

  country?: string;

  searchDomainFilter?: string[];

  searchRecencyFilter?: PerplexitySearchRecencyFilter;

  searchAfterDate?: string;

  searchBeforeDate?: string;

  apiKey: string;

  constructor(fields: PerplexitySearchRetrieverFields = {}) {
    super(fields);

    this.k = fields.k ?? 10;
    this.maxTokens = fields.maxTokens ?? 25000;
    this.maxTokensPerPage = fields.maxTokensPerPage ?? 1024;
    this.country = fields.country;
    this.searchDomainFilter = fields.searchDomainFilter;
    this.searchRecencyFilter = fields.searchRecencyFilter;
    this.searchAfterDate = fields.searchAfterDate;
    this.searchBeforeDate = fields.searchBeforeDate;

    const apiKey =
      fields.apiKey ??
      getEnvironmentVariable("PERPLEXITY_API_KEY") ??
      getEnvironmentVariable("PPLX_API_KEY");

    if (!apiKey) {
      throw new Error("Perplexity API key not found");
    }
    this.apiKey = apiKey;
  }

  /**
   * Build the JSON body posted to the Perplexity Search API.
   */
  buildRequestBody(query: string): PerplexitySearchRequestBody {
    const body: PerplexitySearchRequestBody = {
      query,
      max_results: this.k,
      max_tokens: this.maxTokens,
      max_tokens_per_page: this.maxTokensPerPage,
    };
    if (this.country !== undefined) body.country = this.country;
    if (this.searchDomainFilter !== undefined) {
      body.search_domain_filter = this.searchDomainFilter;
    }
    if (this.searchRecencyFilter !== undefined) {
      body.search_recency_filter = this.searchRecencyFilter;
    }
    if (this.searchAfterDate !== undefined) {
      body.search_after_date = this.searchAfterDate;
    }
    if (this.searchBeforeDate !== undefined) {
      body.search_before_date = this.searchBeforeDate;
    }
    return body;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const body = this.buildRequestBody(query);

    const response = await fetch(PERPLEXITY_SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Perplexity Search API error (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as PerplexitySearchResponse;

    return (data.results ?? []).map(
      (result) =>
        new Document({
          pageContent: result.snippet ?? "",
          metadata: {
            title: result.title,
            url: result.url,
            date: result.date ?? null,
            last_updated: result.last_updated ?? null,
          },
        })
    );
  }
}
