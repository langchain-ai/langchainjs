import { getEnvironmentVariable } from "@langchain/core/utils/env";

const TAVILY_BASE_URL = "https://api.tavily.com";

/**
 * The parameters for the Tavily Search API.
 */
export type TavilySearchParamsBase = {
  /**
   * The query to search for.
   */
  query: string;
  /**
   * The topic of the search.
   *
   * @default "general"
   */
  topic?: "general" | "news" | "finance";
  /**
   * The depth of the search.
   *
   * @default "basic"
   */
  search_depth?: "basic" | "advanced";

  /**
   * The number of {@link TavilySearchResult.content} chunks to retrieve from each source.
   * Each chunk's length is maximum 500 characters. Available only when
   * {@link TavilySearchParams.search_depth} is advanced.
   *
   * @default 3
   */
  chunks_per_source?: number;
  /**
   * The maximum number of search results to return.
   *
   * @default 5
   */
  max_results?: number;
  /**
   * The time range of the search.
   */
  time_range?: "day" | "week" | "month" | "year";
  /**
   * Number of days back from the current date to include. Available only if topic is news.
   */
  days?: number;
  /**
   * Include an LLM-generated answer to the provided query. `"basic"` or `true` returns a quick
   * answer, while `"advanced"` returns a more detailed answer.
   *
   * @default false
   */
  include_answer?: boolean | "basic" | "advanced";
  /**
   * Include the cleaned and parsed HTML content of each search result.
   * "markdown" returns search result content in markdown format.
   * "text" returns the plain text from the results and may increase latency.
   * If true, defaults to "markdown"
   *
   * @default false
   */
  include_raw_content?: boolean | "markdown" | "text";
  /**
   * A list of domains to specifically include in the search results.
   */
  include_domains?: string[];
  /**
   * A list of domains to specifically exclude from the search results.
   */
  exclude_domains?: string[];

  /**
   * Whether to include the favicon URL for each result.
   *
   * @default false
   */
  include_favicon?: boolean;
} & Record<string, unknown>;

export type TavilySearchParamsWithSimpleImages = TavilySearchParamsBase & {
  /**
   * Also perform an image search and include the results in the response.
   *
   * @default false
   */
  include_images?: boolean;
  /**
   * When {@link TavilySearchParams.include_images} is true, also add a descriptive text for each
   * image.
   *
   * @default false
   */
  include_image_descriptions?: false;
};

export type TavilySearchParamsWithImageDescriptions = TavilySearchParamsBase & {
  /**
   * Also perform an image search and include the results in the response.
   */
  include_images?: true;
  /**
   * When {@link TavilySearchParams.include_images} is true, also add a descriptive text for each
   * image.
   */
  include_image_descriptions?: true;
};

export type TavilySearchParams =
  | TavilySearchParamsWithSimpleImages
  | TavilySearchParamsWithImageDescriptions;

/**
 * The parameters for the Tavily Extract API.
 */
export type TavilyExtractParams = {
  /**
   * The URL or list of URLs to extract content from.
   *
   * Example: "https://en.wikipedia.org/wiki/Artificial_intelligence" or
   * ["https://en.wikipedia.org/wiki/Artificial_intelligence", ...]
   */
  urls: string | string[];
  /**
   * Include a list of images extracted from the URLs in the response.
   *
   * @default false
   */
  include_images?: boolean;
  /**
   * The depth of the extraction process. `"advanced"` extraction retrieves more data, including
   * tables and embedded content, with higher success but may increase latency. The cost for
   * `"advanced"` extraction requests may be higher than `"basic"` extraction.
   *
   * @default "basic"
   */
  extract_depth?: "basic" | "advanced";

  /**
   * Whether to include the favicon URL for each result.
   *
   * @default false
   */
  include_favicon?: boolean;

  /**
   * The format of the extracted web page content.
   * "markdown" returns content in markdown format.
   * "text" returns plain text and may increase latency.
   *
   * @default "markdown"
   */
  format?: "markdown" | "text";
} & Record<string, unknown>;

/**
 * The parameters for the Tavily Search API.
 */
export type ExtractDepth = "basic" | "advanced";
export type CrawlCategory =
  | "Documentation"
  | "Blog"
  | "Blogs"
  | "Community"
  | "About"
  | "Contact"
  | "Privacy"
  | "Terms"
  | "Status"
  | "Pricing"
  | "Enterprise"
  | "Careers"
  | "E-Commerce"
  | "Authentication"
  | "Developer"
  | "Developers"
  | "Solutions"
  | "Partners"
  | "Downloads"
  | "Media"
  | "Events"
  | "People";
export type TavilyCrawlParams = {
  /**
   * The URL to start crawling from.
   *
   * Example: "https://example.com"
   */
  url: string;

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
   * Whether to include the favicon URL for each result.
   *
   * @default false
   */
  include_favicon?: boolean;
} & Record<string, unknown>;

/**
 * A single extraction result from the Tavily Extract API.
 */
export type TavilyExtractResult = {
  /**
   * The URL from which the content was extracted.
   */
  url: string;
  /**
   * The full content extracted from the page.
   */
  raw_content: string;
  /**
   * This is only available if {@link TavilyExtractParams.include_images} is set to `true`. A list
   * of image URLs extracted from the page.
   */
  images: string[];
} & Record<string, unknown>;

/**
 * A failed extraction result from the Tavily Extract API.
 */
export type TavilyFailedResult = {
  /**
   * The URL that failed to be processed.
   */
  url: string;
  /**
   * An error message describing why the URL couldn't be processed.
   */
  error: string;
} & Record<string, unknown>;

/**
 * The response from the Tavily Extract API.
 */
export type TavilyExtractResponse = {
  /**
   * A list of extracted content from the provided URLs.
   */
  results: TavilyExtractResult[];
  /**
   * A list of URLs that could not be processed.
   */
  failed_results: TavilyFailedResult[];
  /**
   * Time in seconds it took to complete the request.
   */
  response_time: number;
} & Record<string, unknown>;

/**
 * A single search result from the Tavily Search API.
 */
export type TavilySearchResult = {
  /**
   * The title of the search result.
   */
  title: string;
  /**
   * The URL of the search result.
   */
  url: string;
  /**
   * A short description of the search result.
   */
  content: string;
  /**
   * The relevance score of the search result.
   */
  score: number;
  /**
   * The cleaned and parsed HTML content of the search result. Only if
   * {@link TavilySearchParams.includeRawContent} is true.
   */
  raw_content: string | null;
} & Record<string, unknown>;

/**
 * The base response from the Tavily Search API.
 */
export type TavilyBaseSearchResponse = {
  /**
   * The search query that was executed.
   */
  query: string;
  /**
   * A short answer to the user's query, generated by an LLM. Included in the response only if
   * {@link TavilySearchParams.include_answer} is requested (i.e., set to `true`, `"basic"`, or
   * `"advanced"`).
   */
  answer?: string;
  /**
   * The results from the search.
   */
  auto_parameters?: Partial<TavilySearchParams>;
  results: TavilySearchResult[];
  /**
   * The response time of the search.
   */
  response_time: number;
} & Record<string, unknown>;

/**
 * The shape of the response from the Tavily Search API when
 * {@link TavilySearchParams.include_image_descriptions} is true.
 */
export type TavilySearchResponseWithImageDescriptions =
  TavilyBaseSearchResponse & {
    /**
     * List of query-related images. If {@link TavilySearchParams.include_image_descriptions} is
     * `true`, each item will be an object with `url` and `description` properties. Otherwise, each
     * item will be a string containing the URL of the image.
     */
    images?: {
      /**
       * The URL of the image.
       */
      url: string;
      /**
       * The description of the image.
       */
      description?: string;
    }[];
  };

/**
 * The shape of the response from the Tavily Search API when
 * {@link TavilySearchParams.include_image_descriptions} is `false` or unspecified.
 */
export type TavilySearchResponseWithSimpleImages = TavilyBaseSearchResponse & {
  /**
   * List of query-related images. If {@link TavilySearchParams.include_image_descriptions} is
   * `true`, each item will be an object with `url` and `description` properties. Otherwise, each
   * item will be a string containing the URL of the image.
   */
  images?: string[];
};

export type TavilyCrawlResponse = {
  /**
   * The base URL that was crawled.
   */
  base_url: string;
  /**
   * The results of the crawl.
   */
  results: TavilyExtractResult[];
  /**
   * The response time of the crawl.
   */
  response_time: number;
} & Record<string, unknown>;

/**
 * The parameters for the Tavily Map API.
 */
export type TavilyMapParams = {
  /**
   * The URL to start mapping from.
   *
   * Example: "https://example.com"
   */
  url: string;

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
} & Record<string, unknown>;

export type TavilyMapResponse = {
  /**
   * The base URL that was mapped.
   */
  base_url: string;
  /**
   * The results of the map operation - array of URL strings.
   */
  results: string[];
  /**
   * The response time of the map operation.
   */
  response_time: number;
} & Record<string, unknown>;

export type TavilySearchResponse =
  | TavilySearchResponseWithImageDescriptions
  | TavilySearchResponseWithSimpleImages;

/**
 * Base wrapper class with shared functionality for Tavily API wrappers.
 */
abstract class BaseTavilyAPIWrapper {
  tavilyApiKey?: string;

  apiBaseUrl?: string;

  /**
   * Constructs a new instance of the BaseTavilyAPIWrapper.
   * @param fields The fields used to initialize the wrapper.
   */
  constructor(fields: { tavilyApiKey?: string; apiBaseUrl?: string }) {
    const apiKey =
      fields.tavilyApiKey ?? getEnvironmentVariable("TAVILY_API_KEY");
    if (!apiKey) {
      throw new Error(
        "Tavily API key not found. Please provide it as an argument or set the TAVILY_API_KEY environment variable."
      );
    }
    this.tavilyApiKey = apiKey;
    this.apiBaseUrl = fields.apiBaseUrl ?? TAVILY_BASE_URL;
  }

  /**
   * Converts camelCase keys to snake_case for API compatibility
   * @param params The parameters with camelCase keys
   * @returns The parameters with snake_case keys only
   */
  protected convertCamelToSnakeCase(
    params: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) {
        continue;
      }
      // Convert camelCase key to snake_case
      // Handle potential leading capital letter first
      let newKey = key.replace(/^[A-Z]/, (letter) => letter.toLowerCase());
      // Then handle subsequent capital letters
      newKey = newKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

      result[newKey] = value;
    }

    return result;
  }
}

/**
 * A wrapper that encapsulates access to the Tavily Search API. Primarily used for testing.
 */
export class TavilySearchAPIWrapper extends BaseTavilyAPIWrapper {
  /**
   * Performs a search using the Tavily Search API.
   * @param params The parameters for the search.
   * @returns The raw response body from the Tavily Search API.
   */
  async rawResults(
    params: TavilySearchParamsWithSimpleImages
  ): Promise<TavilySearchResponseWithSimpleImages>;

  async rawResults(
    params: TavilySearchParamsWithImageDescriptions
  ): Promise<TavilySearchResponseWithImageDescriptions>;

  async rawResults(params: TavilySearchParams): Promise<TavilySearchResponse> {
    const headers = {
      Authorization: `Bearer ${this.tavilyApiKey}`,
      "Content-Type": "application/json",
    };

    // Convert camelCase to snake_case for API compatibility
    const apiParams = this.convertCamelToSnakeCase(params);

    const response = await fetch(`${this.apiBaseUrl}/search`, {
      method: "POST",
      headers,
      body: JSON.stringify(apiParams),
    });

    if (!response.ok) {
      console.log(response);
      const errorData = await response.json();
      const errorMessage = errorData.detail?.error || "Unknown error";
      throw new Error(`Error ${response.status}: ${errorMessage}`);
    }

    return response.json();
  }
}

/**
 * A wrapper that encapsulates access to the Tavily Extract API. Primarily used for testing.
 */
export class TavilyExtractAPIWrapper extends BaseTavilyAPIWrapper {
  /**
   * Extracts content from one or more URLs using the Tavily Extract API.
   * @param params The parameters for the extraction. See {@link TavilyExtractParams}.
   * @returns The raw response body from the Tavily Extract API. See {@link TavilyExtractResponse}.
   */
  async rawResults(
    params: TavilyExtractParams
  ): Promise<TavilyExtractResponse> {
    const headers = {
      Authorization: `Bearer ${this.tavilyApiKey}`,
      "Content-Type": "application/json",
    };

    const apiParams = this.convertCamelToSnakeCase(params);

    const response = await fetch(`${this.apiBaseUrl}/extract`, {
      method: "POST",
      headers,
      body: JSON.stringify(apiParams),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.detail?.error || "Unknown error";
      throw new Error(`Error ${response.status}: ${errorMessage}`);
    }

    return response.json();
  }
}

/**
 * A wrapper that encapsulates access to the Tavily Crawl API. Primarily used for testing.
 */
export class TavilyCrawlAPIWrapper extends BaseTavilyAPIWrapper {
  /**
   * Crawls a list of URLs using the Tavily Crawl API.
   * @param params The parameters for the crawl. See {@link TavilyCrawlParams}.
   * @returns The raw response body from the Tavily Crawl API. See {@link TavilyCrawlResponse}.
   */
  async rawResults(params: TavilyCrawlParams): Promise<TavilyCrawlResponse> {
    const headers = {
      Authorization: `Bearer ${this.tavilyApiKey}`,
      "Content-Type": "application/json",
    };

    const apiParams = this.convertCamelToSnakeCase(params);

    const response = await fetch(`${this.apiBaseUrl}/crawl`, {
      method: "POST",
      headers,
      body: JSON.stringify(apiParams),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.detail?.error || "Unknown error";
      throw new Error(`Error ${response.status}: ${errorMessage}`);
    }

    return response.json();
  }
}

/**
 * A wrapper that encapsulates access to the Tavily Map API. Primarily used for testing.
 */
export class TavilyMapAPIWrapper extends BaseTavilyAPIWrapper {
  /**
   * Maps a URL using the Tavily Map API.
   * @param params The parameters for the map. See {@link TavilyMapParams}.
   * @returns The raw response body from the Tavily Map API. See {@link TavilyMapResponse}.
   */
  async rawResults(params: TavilyMapParams): Promise<TavilyMapResponse> {
    const headers = {
      Authorization: `Bearer ${this.tavilyApiKey}`,
      "Content-Type": "application/json",
    };

    const apiParams = this.convertCamelToSnakeCase(params);

    const response = await fetch(`${this.apiBaseUrl}/map`, {
      method: "POST",
      headers,
      body: JSON.stringify(apiParams),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.detail?.error || "Unknown error";
      throw new Error(`Error ${response.status}: ${errorMessage}`);
    }

    return response.json();
  }
}
