import { z } from "zod";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { StructuredTool, ToolParams } from "@langchain/core/tools";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { TavilySearchAPIWrapper, type TavilySearchResponse } from "./utils.js";

export type SearchDepth = "basic" | "advanced";
export type TimeRange = "day" | "week" | "month" | "year";
export type TopicType = "general" | "news" | "finance";

/**
 * Options for the TavilySearchResults tool.
 */
export type TavilySearchAPIRetrieverFields = ToolParams & {
  /**
   * The base URL to be used for the Tavily Search API.
   *
   *
   */
  apiBaseUrl?: string;

  /**
   * The maximum number of search results to return.
   *
   * @default 5
   */
  maxResults?: number;

  /**
   * The API key used for authentication with the Tavily Search API.
   *
   */
  tavilyApiKey?: string;

  /**
   * Include a list of query-related images in the response.
   *
   * @default false
   */
  includeImages?: boolean;

  /**
   * When includeImages is set to True, this option adds descriptive text for each image.
   *
   * @default false
   */
  includeImageDescriptions?: boolean;

  /**
   * Include a short answer to the original query.
   *
   * @default false
   */
  includeAnswer?: boolean;

  /**
   * Include the cleaned and parsed HTML content of each search result.
   * "markdown" returns search result content in markdown format.
   * "text" returns the plain text from the results and may increase latency.
   * If true, defaults to "markdown"
   *
   * @default false
   */
  includeRawContent?: boolean | "markdown" | "text";

  /**
   * A list of domains to specifically include in the search results.
   *
   * @default []
   */
  includeDomains?: string[];

  /**
   * A list of domains to specifically exclude from the search results.
   *
   * @default []
   */
  excludeDomains?: string[];

  /**
   * The depth of the search. It can be "basic" or "advanced".
   *
   * @default "basic"
   */
  searchDepth?: SearchDepth;

  /**
   * The category of the search. This will determine which of our agents will be used for the search. Currently, only "general" and "news" are supported. See https://docs.tavily.com/docs/rest-api/api-reference
   *
   * @default "general"
   */
  topic?: TopicType;

  /**
   * The time range of the search. This will filter the time range of the results back from the current date. See https://docs.tavily.com/docs/rest-api/api-reference
   *
   * @default "general"
   */
  timeRange?: TimeRange;

  /**
   * Whether to include the favicon URL for each result.
   *
   * @default false
   */
  includeFavicon?: boolean;

  /**
   * The name of the tool.
   *
   * @default "tavily_search"
   */
  name?: string;

  /**
   * The description of the tool.
   *
   * @default "A search engine optimized for comprehensive, accurate, and trusted results. Useful for when you need to answer questions about current events. Input should be a search query."
   */
  description?: string;
  /**
   * Whether to return the tool's output directly.
   *
   * Setting this to true means that after the tool is called,
   * an agent should stop looping.
   *
   * @default false
   */
  returnDirect?: boolean;

  /**
   * An API wrapper that can be used to interact with the Tavily Search API. Useful for testing.
   *
   * If specified, the tool will use this API wrapper instead of creating a new one, and fields used
   * in API Wrapper initialization, like {@link TavilySearchAPIRetrieverFields.tavilyApiKey}, will be
   * ignored.
   */
  apiWrapper?: TavilySearchAPIWrapper;

  /**
   * The number of content chunks to retrieve from each source. Each chunk's length is maximum 500 characters. Available only when searchDepth is advanced. See https://docs.tavily.com/docs/rest-api/api-reference
   *
   * @default 3
   */
  chunksPerSource?: number;

  /**
   * The country to search in. MUST be the full country name in lowercase
   * like "united states" or "united kingdom".
   *
   * @default undefined
   */
  country?: string;

  /**
   * Whether to automatically determine optimal search parameters based on the query.
   * This can only be set during tool instantiation, not at invocation time.
   *
   * @default false
   */
  autoParameters?: boolean;
};

function generateSuggestions(params: Record<string, unknown>): string[] {
  const suggestions: string[] = [];

  const { timeRange, includeDomains, excludeDomains, searchDepth, topic } =
    params;

  if (timeRange) {
    suggestions.push("Remove time_range argument");
  }
  if (
    includeDomains &&
    Array.isArray(includeDomains) &&
    includeDomains.length > 0
  ) {
    suggestions.push("Remove include_domains argument");
  }
  if (
    excludeDomains &&
    Array.isArray(excludeDomains) &&
    excludeDomains.length > 0
  ) {
    suggestions.push("Remove exclude_domains argument");
  }
  if (searchDepth === "basic") {
    suggestions.push(
      "Try a more detailed search using 'advanced' search_depth"
    );
  }
  if (topic && topic !== "general") {
    suggestions.push("Try a general search using 'general' topic");
  }

  return suggestions;
}

const inputSchema = z.object({
  query: z.string().describe("Search query to look up"),
  includeDomains: z
    .array(z.string())
    .optional()
    .describe(
      `A list of domains to restrict search results to.

Use this parameter when:
1. The user explicitly requests information from specific websites (e.g., "Find climate data from nasa.gov")
2. The user mentions an organization or company without specifying the domain (e.g., "Find information about iPhones from Apple")

In both cases, you should determine the appropriate domains (e.g., ["nasa.gov"] or ["apple.com"]) and set this parameter.

Results will ONLY come from the specified domains - no other sources will be included.
Default is None (no domain restriction).`
    ),
  excludeDomains: z
    .array(z.string())
    .optional()
    .describe(
      `A list of domains to exclude from search results.

Use this parameter when:
1. The user explicitly requests to avoid certain websites (e.g., "Find information about climate change but not from twitter.com")
2. The user mentions not wanting results from specific organizations without naming the domain (e.g., "Find phone reviews but nothing from Apple")

In both cases, you should determine the appropriate domains to exclude (e.g., ["twitter.com"] or ["apple.com"]) and set this parameter.

Results will filter out all content from the specified domains.
Default is None (no domain exclusion).`
    ),
  searchDepth: z
    .enum(["basic", "advanced"])
    .optional()
    .describe(
      `Controls search thoroughness and result comprehensiveness.

Use "basic" (default) for simple queries requiring quick, straightforward answers.

Use "advanced" for complex queries, specialized topics, 
rare information, or when in-depth analysis is needed.`
    ),
  includeImages: z
    .boolean()
    .optional()
    .describe(
      `Determines if the search returns relevant images along with text results.

Set to True when the user explicitly requests visuals or when images would 
significantly enhance understanding (e.g., "Show me what black holes look like," 
"Find pictures of Renaissance art").

Leave as False (default) for most informational queries where text is sufficient.`
    ),
  timeRange: z
    .enum(["day", "week", "month", "year"])
    .optional()
    .describe(
      `Limits results to content published within a specific timeframe.

ONLY set this when the user explicitly mentions a time period 
(e.g., "latest AI news," "articles from last week").

For less popular or niche topics, use broader time ranges 
("month" or "year") to ensure sufficient relevant results.

Options: "day" (24h), "week" (7d), "month" (30d), "year" (365d).

Default is None.`
    ),
  topic: z
    .enum(["general", "news", "finance"])
    .optional()
    .describe(
      `Specifies search category for optimized results.

Use "general" (default) for most queries, INCLUDING those with terms like 
"latest," "newest," or "recent" when referring to general information.

Use "finance" for markets, investments, economic data, or financial news.

Use "news" ONLY for politics, sports, or major current events covered by 
mainstream media - NOT simply because a query asks for "new" information.`
    ),
});

/**
 * A Tool for performing searches with the Tavily Search API and retrieving
 * the results. Extends the StructuredTool class. It includes optional
 * parameters for refining search results, such as specifying domains,
 * search depth, and time ranges.
 *
 * Authentication is handled via an API key, which can be passed during
 * instantiation or set as an environment variable `TAVILY_API_KEY`.
 *
 * Example:
 * ```typescript
 * const tool = new TavilySearch({
 *   maxResults: 3,
 *   tavilyApiKey: "YOUR_API_KEY"
 * });
 * const results = await tool.invoke({ query: "latest AI news" });
 * console.log(results);
 * ```
 */
export class TavilySearch extends StructuredTool<typeof inputSchema> {
  static lc_name(): string {
    return "TavilySearch";
  }

  override description: string =
    "A search engine optimized for comprehensive, accurate, and trusted " +
    "results. Useful for when you need to answer questions about current " +
    "events. Input should be a search query.";

  override name: string = "tavily_search";

  override schema = inputSchema;

  apiBaseUrl?: string;

  maxResults?: number;

  includeImages?: boolean;

  includeImageDescriptions?: boolean;

  includeAnswer?: boolean;

  includeRawContent?: boolean | "markdown" | "text";

  includeDomains?: string[];

  excludeDomains?: string[];

  searchDepth?: SearchDepth;

  topic?: TopicType;

  days?: number;

  timeRange?: TimeRange;

  chunksPerSource?: number;

  country?: string;

  autoParameters?: boolean;

  includeFavicon?: boolean;

  handleToolError = true;

  apiWrapper: TavilySearchAPIWrapper;

  /**
   * Constructs a new instance of the TavilySearch tool.
   * @param params Optional configuration parameters for the tool.
   *               Includes options like `maxResults`, `tavilyApiKey`,
   *               `includeImages`, `includeAnswer`, `searchDepth`, etc.
   *               See {@link TavilySearchAPIRetrieverFields} for details.
   */
  constructor(params: TavilySearchAPIRetrieverFields = {}) {
    super(params);

    if (params.name) {
      this.name = params.name;
    }

    if (params.description) {
      this.description = params.description;
    }

    if (params.apiWrapper) {
      this.apiWrapper = params.apiWrapper;
    } else {
      const apiWrapperParams: { tavilyApiKey?: string; apiBaseUrl?: string } =
        {};
      if (params.tavilyApiKey) {
        apiWrapperParams.tavilyApiKey = params.tavilyApiKey;
      }
      if (params.apiBaseUrl) {
        apiWrapperParams.apiBaseUrl = params.apiBaseUrl;
      }
      this.apiWrapper = new TavilySearchAPIWrapper(apiWrapperParams);
    }

    this.includeDomains = params.includeDomains;
    this.excludeDomains = params.excludeDomains;
    this.searchDepth = params.searchDepth;
    this.includeImages = params.includeImages;
    this.timeRange = params.timeRange;
    this.maxResults = params.maxResults;
    this.topic = params.topic;
    this.includeAnswer = params.includeAnswer;
    this.includeRawContent = params.includeRawContent;
    this.includeImageDescriptions = params.includeImageDescriptions;
    this.chunksPerSource = params.chunksPerSource;
    this.country = params.country;
    this.autoParameters = params.autoParameters;
    this.includeFavicon = params.includeFavicon;
  }

  async _call(
    input: InferInteropZodOutput<typeof inputSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<TavilySearchResponse | { error: string }> {
    try {
      const {
        query,
        includeDomains,
        excludeDomains,
        searchDepth,
        includeImages,
        timeRange,
        topic,
      } = input;

      // Class instance values take precedence over call parameters
      const effectiveIncludeDomains = this.includeDomains ?? includeDomains;
      const effectiveExcludeDomains = this.excludeDomains ?? excludeDomains;
      const effectiveSearchDepth = this.searchDepth ?? searchDepth;
      const effectiveIncludeImages = this.includeImages ?? includeImages;
      const effectiveTimeRange = this.timeRange ?? timeRange;
      const effectiveTopic = this.topic ?? topic;

      const rawResults = await this.apiWrapper.rawResults({
        query,
        includeDomains: effectiveIncludeDomains,
        excludeDomains: effectiveExcludeDomains,
        searchDepth: effectiveSearchDepth,
        includeImages: effectiveIncludeImages,
        timeRange: effectiveTimeRange,
        topic: effectiveTopic,
        maxResults: this.maxResults,
        includeAnswer: this.includeAnswer,
        includeRawContent: this.includeRawContent,
        includeImageDescriptions: this.includeImageDescriptions,
        chunksPerSource: this.chunksPerSource,
        country: this.country,
        autoParameters: this.autoParameters,
        includeFavicon: this.includeFavicon,
      });

      if (
        !rawResults ||
        typeof rawResults !== "object" ||
        !("results" in rawResults) ||
        !Array.isArray(rawResults.results) ||
        rawResults.results.length === 0
      ) {
        const searchParams = {
          timeRange: effectiveTimeRange,
          includeDomains: effectiveIncludeDomains,
          excludeDomains: effectiveExcludeDomains,
          searchDepth: effectiveSearchDepth,
          topic: effectiveTopic,
        };
        const suggestions = generateSuggestions(searchParams);

        const errorMessage =
          `No search results found for '${query}'. ` +
          `Suggestions: ${suggestions.join(", ")}. ` +
          `Try modifying your search parameters with one of these approaches.`;

        throw new Error(errorMessage);
      }

      return rawResults;
    } catch (e: unknown) {
      const errorMessage =
        e && typeof e === "object" && "message" in e ? e.message : String(e);
      return { error: errorMessage as string };
    }
  }
}
