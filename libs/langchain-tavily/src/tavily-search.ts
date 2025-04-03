import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { StructuredTool, ToolParams } from "@langchain/core/tools";
import { z } from "zod";
import { TavilySearchAPIWrapper, TavilySearchResponseSchema } from "./utils.js";

export type SearchDepth = "basic" | "advanced";
export type TimeRange = "day" | "week" | "month" | "year";
export type TopicType = "general" | "news" | "finance";

/**
 * Options for the TavilySearchResults tool.
 */
export type TavilySearchAPIRetrieverFields = ToolParams & {
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
   *
   * @default false
   */
  includeRawContent?: boolean;

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
};

function generateSuggestions(params: Record<string, unknown>): string[] {
  const suggestions: string[] = [];

  const { search_depth, exclude_domains, include_domains, time_range, topic } =
    params;

  if (time_range) {
    suggestions.push("Remove time_range argument");
  }
  if (
    include_domains &&
    Array.isArray(include_domains) &&
    include_domains.length > 0
  ) {
    suggestions.push("Remove include_domains argument");
  }
  if (
    exclude_domains &&
    Array.isArray(exclude_domains) &&
    exclude_domains.length > 0
  ) {
    suggestions.push("Remove exclude_domains argument");
  }
  if (search_depth === "basic") {
    suggestions.push(
      "Try a more detailed search using 'advanced' search_depth"
    );
  }
  if (topic !== "general") {
    suggestions.push("Try a general search using 'general' topic");
  }

  return suggestions;
}

export class TavilySearch extends StructuredTool {
  static lc_name(): string {
    return "TavilySearch";
  }

  description =
    "A search engine optimized for comprehensive, accurate, and trusted results. Useful for when you need to answer questions about current events. Input should be a search query.";

  name = "tavily_search";

  schema = z.object({
    query: z.string().describe("Search query to look up"),
    includeDomains: z
      .array(z.string())
      .optional()
      .default([])
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
      .default([])
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
      .default("basic")
      .describe(
        `Controls search thoroughness and result comprehensiveness.
      
      Use "basic" for simple queries requiring quick, straightforward answers.
      
      Use "advanced" (default) for complex queries, specialized topics, 
      rare information, or when in-depth analysis is needed.`
      ),
    includeImages: z
      .boolean()
      .optional()
      .default(false)
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
      .default("general")
      .describe(
        `Specifies search category for optimized results.
      
      Use "general" (default) for most queries, INCLUDING those with terms like 
      "latest," "newest," or "recent" when referring to general information.
      
      Use "finance" for markets, investments, economic data, or financial news.
      
      Use "news" ONLY for politics, sports, or major current events covered by 
      mainstream media - NOT simply because a query asks for "new" information.`
      ),
  });

  maxResults = 5;

  apiKey?: string;

  includeImages?: boolean;

  includeImageDescriptions?: boolean;

  includeAnswer?: boolean;

  includeRawContent?: boolean;

  includeDomains?: string[];

  excludeDomains?: string[];

  searchDepth?: SearchDepth;

  topic?: TopicType;

  days?: number;

  timeRange?: TimeRange;

  handleToolError = true;

  apiWrapper: TavilySearchAPIWrapper;

  constructor(params: TavilySearchAPIRetrieverFields = {}) {
    super(params);

    if (params.tavilyApiKey) {
      this.apiWrapper = new TavilySearchAPIWrapper({
        tavilyApiKey: params.tavilyApiKey,
      });
    } else {
      this.apiWrapper = new TavilySearchAPIWrapper({});
    }

    this.includeDomains = params.includeDomains;
    this.excludeDomains = params.excludeDomains;
    this.searchDepth = params.searchDepth ?? "basic";
    this.includeImages = params.includeImages ?? false;
    this.timeRange = params.timeRange;
    this.maxResults = params.maxResults ?? 5;
    this.topic = params.topic ?? "general";
    this.includeAnswer = params.includeAnswer ?? false;
    this.includeRawContent = params.includeRawContent ?? false;
    this.includeImageDescriptions = params.includeImageDescriptions ?? false;
  }

  async _call(
    input: z.infer<(typeof this)["schema"]>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<z.infer<typeof TavilySearchResponseSchema> | { error: string }> {
    try {
      const {
        query,
        includeDomains = this.includeDomains,
        excludeDomains = this.excludeDomains,
        searchDepth = this.searchDepth,
        includeImages = this.includeImages,
        timeRange = this.timeRange,
        topic = this.topic,
      } = input;

      const rawResults = await this.apiWrapper.rawResults({
        query,
        includeDomains,
        excludeDomains,
        searchDepth,
        includeImages,
        timeRange,
        topic,
        maxResults: this.maxResults,
        includeAnswer: this.includeAnswer,
        includeRawContent: this.includeRawContent,
        includeImageDescriptions: this.includeImageDescriptions,
      });

      if (
        !rawResults ||
        typeof rawResults !== "object" ||
        !("results" in rawResults) ||
        !Array.isArray(rawResults.results) ||
        rawResults.results.length === 0
      ) {
        const searchParams = {
          timeRange,
          includeDomains,
          searchDepth,
          excludeDomains,
          topic,
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
