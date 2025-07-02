import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { StructuredTool, ToolParams } from "@langchain/core/tools";
import { z } from "zod";
import { InferInteropZodOutput } from "@langchain/core/dist/utils/types/zod.js";
import {
  TavilyCrawlAPIWrapper,
  type TavilyCrawlResponse,
  ExtractDepth,
  CrawlCategory,
} from "./utils.js";

export type TavilyCrawlAPIRetrieverFields = ToolParams & {
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
   * The depth of the extractions. It can be "basic" or "advanced".
   *
   */
  extractDepth?: ExtractDepth;

  /**
   * The format of the respose. It can be "markdown" or "text"
   *
   * @default "markdown"
   */
  format?: "markdown" | "text";

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
   * Include images in the crawl results.
   *
   * @default false
   */
  includeImages?: boolean;

  /**
   * Include the favicon URL for each crawl result.
   *
   * @default false
   */
  includeFavicon?: boolean;

  /**
   * The name of the tool.
   *
   * @default "tavily_crawl"
   */
  name?: string;

  /**
   * The description of the tool.
   *
   * @default "Starts a smart web crawl from a given URL."
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
   * An API wrapper that can be used to interact with the Tavily Crawl API. Useful for testing.
   *
   * If specified, the tool will use this API wrapper instead of creating a new one, and fields used
   * in API Wrapper initialization, like {@link TavilyCrawlAPIRetrieverFields.tavilyApiKey}, will be
   * ignored.
   */
  apiWrapper?: TavilyCrawlAPIWrapper;
};

function generateSuggestions(): string[] {
  const suggestions: string[] = [];
  suggestions.push("Try adding specific path filters using selectPaths");
  suggestions.push("Try adding domain filters using selectDomains");
  suggestions.push("Try excluding specific domains using excludeDomains");
  return suggestions;
}

const inputSchema = z.object({
  url: z.string().describe("URL to crawl"),
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

export class TavilyCrawl extends StructuredTool<typeof inputSchema> {
  static lc_name() {
    return "tavily_crawl";
  }

  override name: string = "tavily_crawl";

  override description: string =
    "A powerful web crawler that initiates a structured web crawl starting from a specified " +
    "base URL. The crawler uses a BFS Depth: refering to the number of link hops from the root URL. " +
    "A page directly linked from the root is at BFS depth 1, regardless of its URL structure. " +
    "You can control how deep and wide it goes, and guide it to focus on specific sections of the site.";

  override schema = inputSchema;

  extractDepthDefault?: ExtractDepth;

  includeImagesDefault?: boolean;

  formatDefault?: "markdown" | "text";

  maxDepthDefault?: number;

  maxBreadthDefault?: number;

  limitDefault?: number;

  instructionsDefault?: string;

  selectPathsDefault?: string[];

  selectDomainsDefault?: string[];

  excludePathsDefault?: string[];

  excludeDomainsDefault?: string[];

  allowExternalDefault?: boolean;

  categoriesDefault?: CrawlCategory[];

  includeFaviconDefault?: boolean;

  private apiWrapper: TavilyCrawlAPIWrapper;

  constructor(params: TavilyCrawlAPIRetrieverFields = {}) {
    super(params);

    if (typeof params.name === "string") {
      this.name = params.name;
    }

    if (typeof params.description === "string") {
      this.description = params.description;
    }

    if (params.apiWrapper) {
      this.apiWrapper = params.apiWrapper;
    } else if (params.tavilyApiKey) {
      this.apiWrapper = new TavilyCrawlAPIWrapper({
        tavilyApiKey: params.tavilyApiKey,
      });
    } else {
      this.apiWrapper = new TavilyCrawlAPIWrapper({});
    }

    this.extractDepthDefault = params.extractDepth;
    this.includeImagesDefault = params.includeImages;
    this.formatDefault = params.format;
    this.maxDepthDefault = params.maxDepth;
    this.maxBreadthDefault = params.maxBreadth;
    this.limitDefault = params.limit;
    this.instructionsDefault = params.instructions;
    this.selectPathsDefault = params.selectPaths;
    this.selectDomainsDefault = params.selectDomains;
    this.excludePathsDefault = params.excludePaths;
    this.excludeDomainsDefault = params.excludeDomains;
    this.allowExternalDefault = params.allowExternal;
    this.categoriesDefault = params.categories;
    this.includeFaviconDefault = params.includeFavicon;
  }

  async _call(
    input: InferInteropZodOutput<typeof inputSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<TavilyCrawlResponse | { error: string }> {
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
      const effectiveExtractDepth = this.extractDepthDefault;
      const effectiveIncludeImages = this.includeImagesDefault;
      const effectiveFormat = this.formatDefault;
      const effectiveMaxDepth = this.maxDepthDefault;
      const effectiveMaxBreadth = this.maxBreadthDefault;
      const effectiveLimit = this.limitDefault;
      const effectiveInstructions = this.instructionsDefault ?? instructions;
      const effectiveSelectPaths = this.selectPathsDefault ?? selectPaths;
      const effectiveSelectDomains = this.selectDomainsDefault ?? selectDomains;
      const effectiveExcludePaths = this.excludePathsDefault ?? excludePaths;
      const effectiveExcludeDomains =
        this.excludeDomainsDefault ?? excludeDomains;
      const effectiveAllowExternal = this.allowExternalDefault ?? allowExternal;
      const effectiveIncludeFavicon = this.includeFaviconDefault;
      // Remove duplicates from categories and convert to array
      let effectiveCategories: CrawlCategory[] | undefined;
      if (this.categoriesDefault) {
        effectiveCategories = Array.from(new Set(this.categoriesDefault));
      } else if (categories) {
        effectiveCategories = Array.from(new Set(categories));
      } else {
        effectiveCategories = categories;
      }

      const rawResults = await this.apiWrapper.rawResults({
        url,
        extractDepth: effectiveExtractDepth,
        includeImages: effectiveIncludeImages,
        format: effectiveFormat,
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
        includeFavicon: effectiveIncludeFavicon,
      });

      if (
        !rawResults ||
        typeof rawResults !== "object" ||
        !("results" in rawResults) ||
        !Array.isArray(rawResults.results) ||
        rawResults.results.length === 0
      ) {
        const suggestions = generateSuggestions();

        const errorMessage =
          `No crawl results found for '${url}'. ` +
          `Suggestions: ${suggestions.join(", ")}. ` +
          `Try modifying your crawl parameters with one of these approaches.`;

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
