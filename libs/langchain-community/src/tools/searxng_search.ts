import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Tool } from "@langchain/core/tools";

/**
 * Interface for the results returned by the Searxng search.
 */
interface SearxngResults {
  query: string;
  number_of_results: number;
  results: Array<{
    url: string;
    title: string;
    content: string;
    img_src: string;
    engine: string;
    parsed_url: Array<string>;
    template: string;
    engines: Array<string>;
    positions: Array<number>;
    score: number;
    category: string;
    pretty_url: string;
    open_group?: boolean;
    close_group?: boolean;
  }>;
  answers: Array<string>;
  corrections: Array<string>;
  infoboxes: Array<{
    infobox: string;
    content: string;
    engine: string;
    engines: Array<string>;
  }>;
  suggestions: Array<string>;
  unresponsive_engines: Array<string>;
}

/**
 * Interface for custom headers used in the Searxng search.
 */
interface SearxngCustomHeaders {
  [key: string]: string;
}

interface SearxngSearchParams {
  /**
   * @default 10
   * Number of results included in results
   */
  numResults?: number;
  /** Comma separated list, specifies the active search categories
   * https://docs.searxng.org/user/configured_engines.html#configured-engines
   */
  categories?: string;

  /** Comma separated list, specifies the active search engines
   * https://docs.searxng.org/user/configured_engines.html#configured-engines
   */
  engines?: string;

  /** Code of the language. */
  language?: string;
  /** Search page number. */
  pageNumber?: number;
  /**
   * day / month / year
   *
   * Time range of search for engines which support it. See if an engine supports time range search in the preferences page of an instance.
   */
  timeRange?: number;

  /**
   * Throws Error if format is set anything other than "json"
   * Output format of results. Format needs to be activated in search:
   */
  format?: "json";
  /** Open search results on new tab. */
  resultsOnNewTab?: 0 | 1;
  /** Proxy image results through SearXNG. */
  imageProxy?: boolean;
  autocomplete?: string;
  /**
   * Filter search results of engines which support safe search. See if an engine supports safe search in the preferences page of an instance.
   */
  safesearch?: 0 | 1 | 2;
}

/**
 * SearxngSearch class represents a meta search engine tool.
 * Use this class when you need to answer questions about current events.
 * The input should be a search query, and the output is a JSON array of the query results.
 *
 * note: works best with *agentType*: `structured-chat-zero-shot-react-description`
 * https://github.com/searxng/searxng
 * @example
 * ```typescript
 * const executor = AgentExecutor.fromAgentAndTools({
 *   agent,
 *   tools: [
 *     new SearxngSearch({
 *       params: {
 *         format: "json",
 *         engines: "google",
 *       },
 *       headers: {},
 *     }),
 *   ],
 * });
 * const result = await executor.invoke({
 *   input: `What is Langchain? Describe in 50 words`,
 * });
 * ```
 */
export class SearxngSearch extends Tool {
  static lc_name() {
    return "SearxngSearch";
  }

  name = "searxng-search";

  description =
    "A meta search engine. Useful for when you need to answer questions about current events. Input should be a search query. Output is a JSON array of the query results";

  protected apiBase?: string;

  protected params?: SearxngSearchParams = {
    numResults: 10,
    pageNumber: 1,
    format: "json",
    imageProxy: true,
    safesearch: 0,
  };

  protected headers?: SearxngCustomHeaders;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiBase: "SEARXNG_API_BASE",
    };
  }

  /**
   * Constructor for the SearxngSearch class
   * @param apiBase Base URL of the Searxng instance
   * @param params SearxNG parameters
   * @param headers Custom headers
   */
  constructor({
    apiBase,
    params,
    headers,
  }: {
    /** Base URL of Searxng instance */
    apiBase?: string;

    /** SearxNG Paramerters
     *
     *  https://docs.searxng.org/dev/search_api.html check here for more details
     */
    params?: SearxngSearchParams;

    /**
     * Custom headers
     * Set custom headers if you're using a api from RapidAPI (https://rapidapi.com/iamrony777/api/searxng)
     * No headers needed for a locally self-hosted instance
     */
    headers?: SearxngCustomHeaders;
  }) {
    super(...arguments);

    this.apiBase = getEnvironmentVariable("SEARXNG_API_BASE") || apiBase;
    this.headers = { "content-type": "application/json", ...headers };

    if (!this.apiBase) {
      throw new Error(
        `SEARXNG_API_BASE not set. You can set it as "SEARXNG_API_BASE" in your environment variables.`
      );
    }

    if (params) {
      this.params = { ...this.params, ...params };
    }
  }

  /**
   * Builds the URL for the Searxng search.
   * @param path The path for the URL.
   * @param parameters The parameters for the URL.
   * @param baseUrl The base URL.
   * @returns The complete URL as a string.
   */
  protected buildUrl<P extends SearxngSearchParams>(
    path: string,
    parameters: P,
    baseUrl: string
  ): string {
    const nonUndefinedParams: [string, string][] = Object.entries(parameters)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => [key, value.toString()]); // Avoid string conversion
    const searchParams = new URLSearchParams(nonUndefinedParams);
    return `${baseUrl}/${path}?${searchParams}`;
  }

  async _call(input: string): Promise<string> {
    const queryParams = {
      q: input,
      ...this.params,
    };
    const url = this.buildUrl("search", queryParams, this.apiBase as string);

    const resp = await fetch(url, {
      method: "POST",
      headers: this.headers,
      signal: AbortSignal.timeout(5 * 1000), // 5 seconds
    });

    if (!resp.ok) {
      throw new Error(resp.statusText);
    }

    const res: SearxngResults = await resp.json();

    if (
      !res.results.length &&
      !res.answers.length &&
      !res.infoboxes.length &&
      !res.suggestions.length
    ) {
      return "No good results found.";
    } else if (res.results.length) {
      const response: string[] = [];

      res.results.forEach((r) => {
        response.push(
          JSON.stringify({
            title: r.title || "",
            link: r.url || "",
            snippet: r.content || "",
          })
        );
      });

      return response.slice(0, this.params?.numResults).toString();
    } else if (res.answers.length) {
      return res.answers[0];
    } else if (res.infoboxes.length) {
      return res.infoboxes[0]?.content.replaceAll(/<[^>]+>/gi, "");
    } else if (res.suggestions.length) {
      let suggestions = "Suggestions: ";
      res.suggestions.forEach((s) => {
        suggestions += `${s}, `;
      });
      return suggestions;
    } else {
      return "No good results found.";
    }
  }
}
