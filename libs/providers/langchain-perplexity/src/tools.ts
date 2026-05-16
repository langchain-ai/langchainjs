import { Tool, type ToolParams } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import type {
  PerplexitySearchRecencyFilter,
  PerplexitySearchRequestBody,
  PerplexitySearchResponse,
  PerplexitySearchResult,
} from "./retrievers.js";

const PERPLEXITY_SEARCH_URL = "https://api.perplexity.ai/search";

/**
 * Constructor fields for {@link PerplexitySearchResults}.
 */
export interface PerplexitySearchResultsFields extends ToolParams {
  /** Maximum number of results to return (1-20). Defaults to 10. */
  maxResults?: number;

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
 * Tool wrapper around the Perplexity Search API. Returns results as a
 * JSON-encoded array of `{ title, url, snippet, date, last_updated }`.
 *
 * @example
 * ```typescript
 * import { PerplexitySearchResults } from "@langchain/perplexity";
 *
 * const tool = new PerplexitySearchResults({
 *   maxResults: 5,
 *   searchRecencyFilter: "week",
 * });
 *
 * const json = await tool.invoke("Latest LLM benchmarks");
 * ```
 */
export class PerplexitySearchResults extends Tool {
  static lc_name(): string {
    return "PerplexitySearchResults";
  }

  name = "perplexity_search_results_json";

  description =
    "A wrapper around Perplexity Search. " +
    "Input should be a search query. " +
    "Output is a JSON array of the query results";

  maxResults: number;

  country?: string;

  searchDomainFilter?: string[];

  searchRecencyFilter?: PerplexitySearchRecencyFilter;

  searchAfterDate?: string;

  searchBeforeDate?: string;

  apiKey: string;

  constructor(fields: PerplexitySearchResultsFields = {}) {
    super(fields);

    this.maxResults = fields.maxResults ?? 10;
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
      max_results: this.maxResults,
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

  protected async _call(query: string): Promise<string> {
    try {
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
        return `Perplexity search failed: HTTP ${response.status} ${errorText}`;
      }

      const data = (await response.json()) as PerplexitySearchResponse;

      const formatted: PerplexitySearchResult[] = (data.results ?? []).map(
        (result) => ({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          date: result.date ?? null,
          last_updated: result.last_updated ?? null,
        })
      );
      return JSON.stringify(formatted);
    } catch (e) {
      const name = e instanceof Error ? e.name : "Error";
      return `Perplexity search failed: ${name}`;
    }
  }
}
