import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Tool } from "@langchain/core/tools";

/**
 * SERPEX API Parameters
 * 
 * SERPEX provides multi-engine web search results in JSON format.
 * Supports Google, Bing, DuckDuckGo, Brave, Yahoo, and Yandex search engines.
 * 
 * For detailed documentation, visit: https://serpex.dev/docs
 */
export interface SerpexParameters {
  /**
   * Search query string (required)
   */
  q: string;

  /**
   * Search engine to use
   * Options: "auto", "google", "bing", "duckduckgo", "brave", "yahoo", "yandex"
   * Default: "auto" (automatically routes to best available engine)
   */
  engine?: string;

  /**
   * Search category
   * Currently only "web" is supported
   * More categories (images, videos, news) coming soon
   * Default: "web"
   */
  category?: string;

  /**
   * Time range filter for results
   * Options: "all", "day", "week", "month", "year"
   * Note: Not supported by Brave engine
   */
  time_range?: string;
}

/**
 * Serpex Class
 * 
 * A tool for searching the web using the SERPEX API, which provides
 * multi-engine search results from Google, Bing, DuckDuckGo, Brave, Yahoo, and Yandex.
 * 
 * Requires SERPEX_API_KEY environment variable or passed as parameter.
 * Get your API key at: https://serpex.dev
 * 
 * @example
 * ```typescript
 * const serpex = new Serpex("your-api-key", {
 *   engine: "auto",
 *   category: "web",
 *   time_range: "day"
 * });
 * 
 * const agent = RunnableSequence.from([
 *   ChatPromptTemplate.fromMessages([
 *     ["ai", "Answer the following questions using concise bullet points."],
 *     ["human", "{input}"],
 *   ]),
 *   new ChatOpenAI({ model: "gpt-4", temperature: 0 }),
 *   (input: BaseMessageChunk) => ({
 *     log: "Processed search results",
 *     returnValues: {
 *       output: input,
 *     },
 *   }),
 * ]);
 * 
 * const executor = AgentExecutor.fromAgentAndTools({
 *   agent,
 *   tools: [serpex],
 * });
 * 
 * const result = await executor.invoke({
 *   input: "What are the latest AI developments?"
 * });
 * console.log(result);
 * ```
 */
export class Serpex extends Tool {
  static lc_name() {
    return "Serpex";
  }

  name = "serpex_search";

  description =
    "A powerful multi-engine web search tool. Useful for answering questions about current events, finding information from the web, and getting real-time data. Input should be a search query string. Supports automatic routing with retry logic and multiple search engines (Google, Bing, DuckDuckGo, Brave, Yahoo, Yandex).";

  protected apiKey: string;

  protected params: Partial<SerpexParameters>;

  protected baseURL: string;

  /**
   * @param apiKey - SERPEX API key (optional if SERPEX_API_KEY env var is set)
   * @param params - Default parameters for all searches
   * @param baseURL - Base URL for Serpex API (defaults to production API)
   */
  constructor(
    apiKey: string | undefined = getEnvironmentVariable("SERPEX_API_KEY"),
    params: Partial<SerpexParameters> = {},
    baseURL: string = getEnvironmentVariable("SERPEX_BASE_URL") || "https://api.serpex.dev"
  ) {
    super();

    if (!apiKey) {
      throw new Error(
        "SERPEX API key is required. Set it as SERPEX_API_KEY in your environment variables, or pass it to the Serpex constructor."
      );
    }

    this.apiKey = apiKey;
    this.params = params;
    this.baseURL = baseURL;
  }

  /**
   * Converts the Serpex instance to JSON
   * @returns Throws an error (not implemented)
   */
  toJSON() {
    return this.toJSONNotImplemented();
  }

  /**
   * Builds the API request URL with query parameters
   * @param searchQuery - The search query string
   * @returns Complete API URL with parameters
   */
  protected buildUrl(searchQuery: string): string {
    const preparedParams: [string, string][] = Object.entries({
      engine: "auto",
      category: "web",
      ...this.params,
      q: searchQuery,
    })
      .filter(([key, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, `${value}`]);

    const searchParams = new URLSearchParams(preparedParams);
    return `${this.baseURL}/api/search?${searchParams}`;
  }

  /**
   * Executes the search and processes results
   * @param input - Search query string
   * @returns Formatted search results
   */
  async _call(input: string): Promise<string> {
    try {
      const url = this.buildUrl(input);
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `SERPEX API request failed with status ${response.status}: ${errorText}`
        );
      }

      const json = await response.json();

      if (json.error) {
        throw new Error(
          `SERPEX API returned an error: ${json.error}`
        );
      }

      // Process response based on actual Serpex API format
      // Response structure: { metadata, id, query, engines, results, answers, corrections, infoboxes, suggestions }
      
      // Instant answers (from knowledge panels/answer boxes)
      if (json.answers && Array.isArray(json.answers) && json.answers.length > 0) {
        const answer = json.answers[0];
        if (answer.answer || answer.snippet) {
          return answer.answer || answer.snippet;
        }
      }

      // Infoboxes (knowledge panels)
      if (json.infoboxes && Array.isArray(json.infoboxes) && json.infoboxes.length > 0) {
        const infobox = json.infoboxes[0];
        if (infobox.description) {
          return infobox.description;
        }
      }

      // Organic search results
      if (json.results && Array.isArray(json.results) && json.results.length > 0) {
        const snippets = json.results
          .filter((result: any) => result.snippet || result.title)
          .slice(0, 10) // Limit to top 10 results
          .map((result: any, index: number) => {
            const title = result.title || "";
            const snippet = result.snippet || "";
            const url = result.url || "";
            const published = result.published_date ? `\nPublished: ${result.published_date}` : "";
            return `[${index + 1}] ${title}\nURL: ${url}\n${snippet}${published}`;
          });

        if (snippets.length > 0) {
          const header = `Found ${json.metadata?.number_of_results || json.results.length} results:\n\n`;
          return header + snippets.join("\n\n");
        }
      }

      // Search suggestions
      if (json.suggestions && Array.isArray(json.suggestions) && json.suggestions.length > 0) {
        return `No direct results found. Related searches:\n${json.suggestions.join("\n")}`;
      }

      // Query corrections
      if (json.corrections && Array.isArray(json.corrections) && json.corrections.length > 0) {
        return `Did you mean: ${json.corrections.join(", ")}?`;
      }

      return "No search results found.";
    } catch (error) {
      if (error instanceof Error) {
        return `Error searching with SERPEX: ${error.message}`;
      }
      return `Unknown error occurred while searching with SERPEX`;
    }
  }
}
