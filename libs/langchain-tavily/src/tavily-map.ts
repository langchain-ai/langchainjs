import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { StructuredTool, ToolParams } from "@langchain/core/tools";
import { z } from "zod/v3";
import { InferInteropZodOutput } from "@langchain/core/dist/utils/types/zod.js";
import {
  TavilyMapAPIWrapper,
  type TavilyMapResponse,
  CrawlCategory,
} from "./utils.js";

export type TavilyMapAPIRetrieverFields = ToolParams & {
  /**
   * The base URL to be used for the Tavily Search API.
   *
   *
   */
  apiBaseUrl?: string;

  /**
   * The API key used for authentication with the Tavily Search API.
   *
   */
  tavilyApiKey?: string;

  /**
   * Natural language instructions to guide the crawler
   *
   * @default undefined
   */
  instructions?: string;

  /**
   * The maximum number of hops from the starting URL.
   *
   * @default 3
   */
  maxDepth?: number;

  /**
   * The maximum number of pages to crawl per level.
   *
   * @default 50
   */
  maxBreadth?: number;

  /**
   * The maximum number of pages to crawl.
   *
   * @default 100
   */
  limit?: number;

  /**
   * Only crawl URLs containing these categories.
   *
   * @default undefined
   */
  categories?: CrawlCategory[];

  /**
   * Only crawl URLs containing these paths.
   *
   * @default undefined
   */
  selectPaths?: string[];

  /**
   * Only crawl these domains.
   *
   * @default undefined
   */
  selectDomains?: string[];

  /**
   * Exclude these paths.
   *
   * @default undefined
   */
  excludePaths?: string[];

  /**
   * Exclude these domains.
   *
   * @default undefined
   */
  excludeDomains?: string[];

  /**
   * Allow crawling external domains.
   *
   * @default undefined
   */
  allowExternal?: boolean;

  /**
   * The name of the tool.
   *
   * @default "tavily_map"
   */
  name?: string;

  /**
   * The description of the tool.
   *
   * @default "Creates a site map by crawling a website starting from a given URL."
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
   * An API wrapper that can be used to interact with the Tavily Map API. Useful for testing.
   *
   * If specified, the tool will use this API wrapper instead of creating a new one, and fields used
   * in API Wrapper initialization, like {@link TavilyMapAPIRetrieverFields.tavilyApiKey}, will be
   * ignored.
   */
  apiWrapper?: TavilyMapAPIWrapper;
};

function generateSuggestions(params: Record<string, unknown>): string[] {
  const suggestions: string[] = [];

  const { selectPaths, selectDomains, excludeDomains } = params;

  if (
    !selectPaths ||
    (Array.isArray(selectPaths) && selectPaths.length === 0)
  ) {
    suggestions.push("Try adding specific path filters using selectPaths");
  }
  if (
    !selectDomains ||
    (Array.isArray(selectDomains) && selectDomains.length === 0)
  ) {
    suggestions.push("Try adding domain filters using selectDomains");
  }
  if (
    !excludeDomains ||
    (Array.isArray(excludeDomains) && excludeDomains.length === 0)
  ) {
    suggestions.push("Try excluding specific domains using excludeDomains");
  }
  return suggestions;
}

const inputSchema = z.object({
  url: z.string().describe("URL to map"),
  instructions: z
    .string()
    .optional()
    .describe(
      "Natural language instructions for the crawler. Example: 'Python SDK'"
    ),
  selectPaths: z
    .array(z.string())
    .optional()
    .describe(
      "Regex patterns to select only URLs with specific path patterns. Example: ['/api/v1.*']"
    ),
  selectDomains: z
    .array(z.string())
    .optional()
    .describe(
      "Regex patterns to select only URLs from specific domains or subdomains. Example: ['^docs\\.example\\.com$']"
    ),
  excludePaths: z
    .array(z.string())
    .optional()
    .describe(
      "Regex patterns to exclude URLs with specific path patterns. Example: ['/private/.*', '/admin/.*']"
    ),
  excludeDomains: z
    .array(z.string())
    .optional()
    .describe(
      "Regex patterns to exclude specific domains or subdomains from crawling. Example: ['^private\\.example\\.com$']"
    ),
  allowExternal: z
    .boolean()
    .optional()
    .describe("Whether to allow following links that go to external domains."),
  categories: z
    .array(
      z.enum([
        "Documentation",
        "Blog",
        "Blogs",
        "Community",
        "About",
        "Contact",
        "Privacy",
        "Terms",
        "Status",
        "Pricing",
        "Enterprise",
        "Careers",
        "E-Commerce",
        "Authentication",
        "Developer",
        "Developers",
        "Solutions",
        "Partners",
        "Downloads",
        "Media",
        "Events",
        "People",
      ])
    )
    .optional()
    .describe(
      "Filter URLs using predefined categories like 'Documentation', 'Blogs', etc."
    ),
});

export class TavilyMap extends StructuredTool<typeof inputSchema> {
  static lc_name() {
    return "tavily_map";
  }

  override name: string = "tavily_map";

  override description: string =
    "Creates a comprehensive site map by crawling a website starting from a specified " +
    "base URL. The tool returns a list of discovered URLs, making it ideal for " +
    "understanding website structure, discovering content, and mapping out site architecture. " +
    "You can control how deep and wide it goes, and guide it to focus on specific sections of the site.";

  override schema = inputSchema;

  apiBaseUrl?: string;

  maxDepth?: number;

  maxBreadth?: number;

  limit?: number;

  instructions?: string;

  selectPaths?: string[];

  selectDomains?: string[];

  excludePaths?: string[];

  excludeDomains?: string[];

  allowExternal?: boolean;

  categories?: CrawlCategory[];

  private apiWrapper: TavilyMapAPIWrapper;

  constructor(params: TavilyMapAPIRetrieverFields = {}) {
    super(params);

    if (typeof params.name === "string") {
      this.name = params.name;
    }

    if (typeof params.description === "string") {
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
      this.apiWrapper = new TavilyMapAPIWrapper(apiWrapperParams);
    }

    this.maxDepth = params.maxDepth;
    this.maxBreadth = params.maxBreadth;
    this.limit = params.limit;
    this.instructions = params.instructions;
    this.selectPaths = params.selectPaths;
    this.selectDomains = params.selectDomains;
    this.excludePaths = params.excludePaths;
    this.excludeDomains = params.excludeDomains;
    this.allowExternal = params.allowExternal;
    this.categories = params.categories;
  }

  async _call(
    input: InferInteropZodOutput<typeof inputSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<TavilyMapResponse | { error: string }> {
    try {
      const {
        url,
        instructions,
        selectPaths,
        selectDomains,
        excludePaths,
        excludeDomains,
        allowExternal,
        categories,
      } = input;

      // Class instance values take precedence over call parameters
      const effectiveMaxDepth = this.maxDepth;
      const effectiveMaxBreadth = this.maxBreadth;
      const effectiveLimit = this.limit;
      const effectiveInstructions = this.instructions ?? instructions;
      const effectiveSelectPaths = this.selectPaths ?? selectPaths;
      const effectiveSelectDomains = this.selectDomains ?? selectDomains;
      const effectiveExcludePaths = this.excludePaths ?? excludePaths;
      const effectiveExcludeDomains = this.excludeDomains ?? excludeDomains;
      const effectiveAllowExternal = this.allowExternal ?? allowExternal;
      // Remove duplicates from categories and convert to array
      let effectiveCategories: CrawlCategory[] | undefined;
      if (this.categories) {
        effectiveCategories = Array.from(new Set(this.categories));
      } else if (categories) {
        effectiveCategories = Array.from(new Set(categories));
      } else {
        effectiveCategories = categories;
      }

      const rawResults = await this.apiWrapper.rawResults({
        url,
        maxDepth: effectiveMaxDepth,
        maxBreadth: effectiveMaxBreadth,
        limit: effectiveLimit,
        instructions: effectiveInstructions,
        selectPaths: effectiveSelectPaths,
        selectDomains: effectiveSelectDomains,
        excludePaths: effectiveExcludePaths,
        excludeDomains: effectiveExcludeDomains,
        allowExternal: effectiveAllowExternal,
        categories: effectiveCategories,
      });

      if (
        !rawResults ||
        typeof rawResults !== "object" ||
        !("results" in rawResults) ||
        !Array.isArray(rawResults.results) ||
        rawResults.results.length === 0
      ) {
        const suggestions = generateSuggestions(input);

        const errorMessage =
          `No map results found for '${url}'. ` +
          `Suggestions: ${suggestions.join(", ")}. ` +
          `Try modifying your map parameters with one of these approaches.`;

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
