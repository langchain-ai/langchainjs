import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  ValyuSearchClient,
  ValyuSearchClientResponse,
  ValyuContentsClient,
  ValyuContentsClientResponse,
  ValyuAdapter,
} from "../retrievers/valyu.js";

/**
 * Interface for the ValyuSearchTool fields.
 */
export interface ValyuSearchToolFields {
  client?: ValyuSearchClient;
  apiKey?: string;
  baseUrl?: string;
  name?: string;
  description?: string;
}

/**
 * Interface for the ValyuSearchTool input.
 */
export interface ValyuSearchToolInput {
  query: string;
  search_type?: string;
  max_num_results?: number;
  relevance_threshold?: number;
  max_price?: number;
  is_tool_call?: boolean;
  start_date?: string;
  end_date?: string;
  included_sources?: string[];
  excluded_sources?: string[];
  response_length?: number | string;
  country_code?: string;
  fast_mode?: boolean;
}

/**
 * A wrapper around the Valyu deep search API to search for relevant content
 * from proprietary and web sources.
 * @example
 * ```typescript
 * const tool = new ValyuSearchTool({
 *   apiKey: process.env.VALYU_API_KEY,
 * });
 * const result = await tool.invoke({ query: "hello" });
 * ```
 */
export class ValyuSearchTool extends StructuredTool {
  name = "valyu_deep_search";

  description =
    "A wrapper around the Valyu deep search API to search for relevant content from proprietary and web sources. " +
    "Input is a query and search parameters. " +
    "Output is a JSON object with the search results.";

  schema = z.object({
    query: z.string().describe("The input query to be processed."),
    search_type: z
      .string()
      .optional()
      .default("all")
      .describe(
        "Type of search: 'all', 'proprietary', or 'web'. Defaults to 'all'."
      ),
    max_num_results: z
      .number()
      .optional()
      .default(10)
      .describe(
        "The maximum number of results to be returned (1-20). Defaults to 10."
      ),
    relevance_threshold: z
      .number()
      .optional()
      .default(0.5)
      .describe(
        "The minimum relevance score required for a result to be included (0.0-1.0). Defaults to 0.5."
      ),
    max_price: z
      .number()
      .optional()
      .default(50.0)
      .describe("Maximum cost in dollars for this search. Defaults to 50.0."),
    is_tool_call: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "Set to true when called by AI agents/tools (optimized for LLM consumption). Defaults to true."
      ),
    start_date: z
      .string()
      .optional()
      .describe(
        "Start date for time filtering in YYYY-MM-DD format (optional)."
      ),
    end_date: z
      .string()
      .optional()
      .describe("End date for time filtering in YYYY-MM-DD format (optional)."),
    included_sources: z
      .array(z.string())
      .optional()
      .describe(
        "List of URLs, domains, or datasets to include in search results (optional)."
      ),
    excluded_sources: z
      .array(z.string())
      .optional()
      .describe(
        "List of URLs, domains, or datasets to exclude from search results (optional)."
      ),
    response_length: z
      .union([z.number(), z.string()])
      .optional()
      .describe(
        "Content length per item: int for character count, or 'short' (25k), 'medium' (50k), 'large' (100k), 'max' (full content) (optional)."
      ),
    country_code: z
      .string()
      .optional()
      .describe(
        "2-letter ISO country code (e.g., 'GB', 'US') to bias search results to a specific country (optional)."
      ),
    fast_mode: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Enable fast mode for faster but shorter results. Good for general purpose queries. Defaults to false."
      ),
  });

  client: ValyuSearchClient;

  constructor(fields: ValyuSearchToolFields = {}) {
    super();

    if (fields.client) {
      this.client = fields.client;
    } else {
      const apiKey =
        fields.apiKey ?? getEnvironmentVariable("VALYU_API_KEY");
      if (!apiKey) {
        throw new Error(
          `No Valyu API key found. Either set an environment variable named "VALYU_API_KEY" or pass an API key as "apiKey".`
        );
      }
      this.client = new ValyuAdapter(apiKey, fields.baseUrl);
    }

    if (fields.name) {
      this.name = fields.name;
    }
    if (fields.description) {
      this.description = fields.description;
    }
  }

  static lc_name() {
    return "ValyuSearchTool";
  }

  protected async _call(input: ValyuSearchToolInput): Promise<string> {
    try {
      const response = (await this.client.search({
        query: input.query,
        search_type: input.search_type ?? "all",
        max_num_results: input.max_num_results ?? 10,
        relevance_threshold: input.relevance_threshold ?? 0.5,
        max_price: input.max_price ?? 50.0,
        is_tool_call: input.is_tool_call ?? true,
        start_date: input.start_date,
        end_date: input.end_date,
        included_sources: input.included_sources,
        excluded_sources: input.excluded_sources,
        response_length: input.response_length,
        country_code: input.country_code,
        fast_mode: input.fast_mode ?? false,
      })) as ValyuSearchClientResponse;

      // Convert response to JSON string
      if (typeof response === "string") {
        return response;
      }
      if (response && typeof response === "object") {
        return JSON.stringify(response);
      }
      return JSON.stringify(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorType =
        error instanceof Error ? error.constructor.name : "UnknownError";
      return JSON.stringify({
        success: false,
        error: errorMessage,
        error_type: errorType,
      });
    }
  }
}

/**
 * Interface for the ValyuContentsTool fields.
 */
export interface ValyuContentsToolFields {
  client?: ValyuContentsClient;
  apiKey?: string;
  baseUrl?: string;
  summary?: boolean | string | Record<string, unknown>;
  extract_effort?: "normal" | "high" | "auto";
  response_length?: number | string;
  name?: string;
  description?: string;
}

/**
 * A wrapper around the Valyu contents API to extract clean content from web pages.
 * @example
 * ```typescript
 * const tool = new ValyuContentsTool({
 *   apiKey: process.env.VALYU_API_KEY,
 * });
 * const result = await tool.invoke({ urls: ["https://example.com"] });
 * ```
 */
export class ValyuContentsTool extends StructuredTool {
  name = "valyu_contents_extract";

  description =
    "A wrapper around the Valyu contents API to extract clean content from web pages. " +
    "Input is a list of URLs. " +
    "Output is a JSON object with the extracted content from each URL.";

  schema = z.object({
    urls: z
      .array(z.string())
      .describe(
        "List of URLs to extract content from (maximum 10 URLs per request)."
      ),
  });

  client: ValyuContentsClient;

  summary?: boolean | string | Record<string, unknown>;

  extract_effort: "normal" | "high" | "auto";

  response_length: number | string;

  constructor(fields: ValyuContentsToolFields = {}) {
    super();

    if (fields.client) {
      this.client = fields.client;
    } else {
      const apiKey =
        fields.apiKey ?? getEnvironmentVariable("VALYU_API_KEY");
      if (!apiKey) {
        throw new Error(
          `No Valyu API key found. Either set an environment variable named "VALYU_API_KEY" or pass an API key as "apiKey".`
        );
      }
      this.client = new ValyuAdapter(apiKey, fields.baseUrl);
    }

    this.summary = fields.summary;
    this.extract_effort = fields.extract_effort ?? "normal";
    this.response_length = fields.response_length ?? "short";

    if (fields.name) {
      this.name = fields.name;
    }
    if (fields.description) {
      this.description = fields.description;
    }
  }

  static lc_name() {
    return "ValyuContentsTool";
  }

  protected async _call(input: { urls: string[] }): Promise<string> {
    try {
      const response = (await this.client.contents({
        urls: input.urls,
        summary: this.summary,
        extract_effort: this.extract_effort,
        response_length: this.response_length,
      })) as ValyuContentsClientResponse;

      // Convert response to JSON string
      if (typeof response === "string") {
        return response;
      }
      if (response && typeof response === "object") {
        return JSON.stringify(response);
      }
      return JSON.stringify(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorType =
        error instanceof Error ? error.constructor.name : "UnknownError";
      return JSON.stringify({
        success: false,
        error: errorMessage,
        error_type: errorType,
      });
    }
  }
}

