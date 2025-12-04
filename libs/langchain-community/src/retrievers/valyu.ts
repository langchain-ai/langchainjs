import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import { Valyu } from "valyu-js";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Interface for the Valyu search client.
 */
export interface ValyuSearchClient {
  search(args: {
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
  }): Promise<ValyuSearchClientResponse>;
}

/**
 * Interface for the Valyu search client response.
 */
export interface ValyuSearchClientResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    source?: string;
    price?: number;
    length?: number;
    data_type?: string;
    relevance_score?: number;
    image_url?: unknown;
  }>;
}

/**
 * Interface for the Valyu contents client.
 */
export interface ValyuContentsClient {
  contents(args: {
    urls: string[];
    summary?: boolean | string | Record<string, unknown>;
    extract_effort?: "normal" | "high" | "auto";
    response_length?: number | string;
  }): Promise<ValyuContentsClientResponse>;
}

/**
 * Interface for the Valyu contents client response.
 */
export interface ValyuContentsClientResponse {
  results?: Array<{
    url?: string;
    title?: string;
    content?: string;
    status?: string;
    price?: number;
    length?: number;
    extraction_effort?: string;
    error?: string;
  }>;
}

/**
 * Adapter class that wraps the Valyu SDK client and implements both
 * ValyuSearchClient and ValyuContentsClient interfaces.
 */
export class ValyuAdapter implements ValyuSearchClient, ValyuContentsClient {
  private client: Valyu;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new Valyu(apiKey, baseUrl);
  }

  async search(args: {
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
  }): Promise<ValyuSearchClientResponse> {
    const options: any = {};

    if (args.search_type) options.searchType = args.search_type;
    if (args.max_num_results !== undefined)
      options.maxNumResults = args.max_num_results;
    if (args.relevance_threshold !== undefined)
      options.relevanceThreshold = args.relevance_threshold;
    if (args.max_price !== undefined) options.maxPrice = args.max_price;
    if (args.is_tool_call !== undefined) options.isToolCall = args.is_tool_call;
    if (args.start_date) options.startDate = args.start_date;
    if (args.end_date) options.endDate = args.end_date;
    if (args.included_sources) options.includedSources = args.included_sources;
    if (args.excluded_sources) options.excludeSources = args.excluded_sources;
    if (args.response_length !== undefined)
      options.responseLength = args.response_length;
    if (args.country_code) options.countryCode = args.country_code;
    if (args.fast_mode !== undefined) options.fastMode = args.fast_mode;

    const response = await this.client.search(args.query, options);
    return response as unknown as ValyuSearchClientResponse;
  }

  async contents(args: {
    urls: string[];
    summary?: boolean | string | Record<string, unknown>;
    extract_effort?: "normal" | "high" | "auto";
    response_length?: number | string;
  }): Promise<ValyuContentsClientResponse> {
    const options: any = {};

    if (args.summary !== undefined) options.summary = args.summary;
    if (args.extract_effort) options.extractEffort = args.extract_effort;
    if (args.response_length !== undefined)
      options.responseLength = args.response_length;

    const response = await this.client.contents(args.urls, options);
    return response as unknown as ValyuContentsClientResponse;
  }
}

function _getValyuMetadata(
  result: NonNullable<ValyuSearchClientResponse["results"]>[0]
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    title: result?.title ?? null,
    url: result?.url ?? null,
    source: result?.source ?? null,
    price: result?.price ?? null,
    length: result?.length ?? null,
    data_type: result?.data_type ?? null,
    relevance_score: result?.relevance_score ?? null,
  };
  if (result?.image_url) {
    metadata.image_url = result.image_url;
  }
  return metadata;
}

function _getContentsMetadata(
  result: NonNullable<ValyuContentsClientResponse["results"]>[0]
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    url: result?.url ?? null,
    title: result?.title ?? null,
    status: result?.status ?? null,
    price: result?.price ?? null,
    length: result?.length ?? null,
    extraction_effort: result?.extraction_effort ?? null,
  };
  if (result?.error) {
    metadata.error = result.error;
  }
  return metadata;
}

/**
 * Options for the ValyuRetriever class.
 */
export interface ValyuRetrieverFields extends BaseRetrieverInput {
  client?: ValyuSearchClient;
  apiKey?: string;
  baseUrl?: string;
  k?: number;
  searchType?: string;
  relevanceThreshold?: number;
  maxPrice?: number;
  isToolCall?: boolean;
  startDate?: string;
  endDate?: string;
  includedSources?: string[];
  excludedSources?: string[];
  responseLength?: number | string;
  countryCode?: string;
  fastMode?: boolean;
}

/**
 * A class for retrieving documents related to a given search term
 * using the Valyu deep search API.
 * @example
 * ```typescript
 * const retriever = new ValyuRetriever({
 *   apiKey: process.env.VALYU_API_KEY,
 *   k: 10,
 * });
 * const docs = await retriever.getRelevantDocuments("hello");
 * ```
 */
export class ValyuRetriever extends BaseRetriever {
  static lc_name() {
    return "ValyuRetriever";
  }

  get lc_namespace(): string[] {
    return ["langchain", "retrievers", "valyu"];
  }

  k: number;

  searchType: string;

  relevanceThreshold: number;

  maxPrice: number;

  isToolCall: boolean;

  startDate?: string;

  endDate?: string;

  includedSources?: string[];

  excludedSources?: string[];

  responseLength?: number | string;

  countryCode?: string;

  fastMode: boolean;

  client: ValyuSearchClient;

  constructor(fields: ValyuRetrieverFields) {
    super(fields);

    this.k = fields.k ?? 10;
    this.searchType = fields.searchType ?? "all";
    this.relevanceThreshold = fields.relevanceThreshold ?? 0.5;
    this.maxPrice = fields.maxPrice ?? 50.0;
    this.isToolCall = fields.isToolCall ?? true;
    this.startDate = fields.startDate;
    this.endDate = fields.endDate;
    this.includedSources = fields.includedSources;
    this.excludedSources = fields.excludedSources;
    this.responseLength = fields.responseLength;
    this.countryCode = fields.countryCode;
    this.fastMode = fields.fastMode ?? false;

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
  }

  async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    const response = (await this.client.search({
      query,
      search_type: this.searchType,
      max_num_results: this.k,
      relevance_threshold: this.relevanceThreshold,
      max_price: this.maxPrice,
      is_tool_call: this.isToolCall,
      start_date: this.startDate,
      end_date: this.endDate,
      included_sources: this.includedSources,
      excluded_sources: this.excludedSources,
      response_length: this.responseLength,
      country_code: this.countryCode,
      fast_mode: this.fastMode,
    })) as ValyuSearchClientResponse;

    const results = response.results || [];

    return results.map(
      (result) =>
        new Document({
          pageContent: String(result.content ?? ""),
          metadata: _getValyuMetadata(result),
        })
    );
  }
}

/**
 * Options for the ValyuContentsRetriever class.
 */
export interface ValyuContentsRetrieverFields extends BaseRetrieverInput {
  client?: ValyuContentsClient;
  apiKey?: string;
  baseUrl?: string;
  urls?: string[];
  summary?: boolean | string | Record<string, unknown>;
  extractEffort?: "normal" | "high" | "auto";
  responseLength?: number | string;
}

/**
 * A class for retrieving content from URLs using the Valyu contents API.
 * @example
 * ```typescript
 * const retriever = new ValyuContentsRetriever({
 *   apiKey: process.env.VALYU_API_KEY,
 *   urls: ["https://example.com"],
 * });
 * const docs = await retriever.getRelevantDocuments("");
 * ```
 */
export class ValyuContentsRetriever extends BaseRetriever {
  static lc_name() {
    return "ValyuContentsRetriever";
  }

  get lc_namespace(): string[] {
    return ["langchain", "retrievers", "valyu"];
  }

  urls: string[];

  summary?: boolean | string | Record<string, unknown>;

  extractEffort: "normal" | "high" | "auto";

  responseLength?: number | string;

  client: ValyuContentsClient;

  constructor(fields: ValyuContentsRetrieverFields) {
    super(fields);

    this.urls = fields.urls ?? [];
    this.summary = fields.summary;
    this.extractEffort = fields.extractEffort ?? "normal";
    this.responseLength = fields.responseLength ?? "short";

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
  }

  async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    // For contents retriever, the query should be a comma-separated list of URLs
    // or we use the pre-configured URLs
    let urls: string[];
    if (this.urls.length === 0) {
      // Parse URLs from query if not pre-configured
      urls = query
        .split(",")
        .map((url) => url.trim())
        .filter((url) => url.length > 0);
    } else {
      urls = this.urls;
    }

    if (urls.length === 0) {
      return [];
    }

    const response = (await this.client.contents({
      urls,
      summary: this.summary,
      extract_effort: this.extractEffort,
      response_length: this.responseLength,
    })) as ValyuContentsClientResponse;

    const results = response.results || [];

    return results.map(
      (result) =>
        new Document({
          pageContent: String(result.content ?? ""),
          metadata: _getContentsMetadata(result),
        })
    );
  }
}

