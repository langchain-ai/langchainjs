import { getEnvironmentVariable } from "@langchain/core/utils/env";

const TAVILY_BASE_URL = "https://api.tavily.com";

export interface TavilyExtractParams {
  urls: string[];
  includeImages?: boolean;
  extractDepth?: "basic" | "advanced";
}

export interface TavilySearchParams {
  query: string;
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
  includeDomains?: string[];
  excludeDomains?: string[];
  includeAnswer?: boolean;
  includeRawContent?: boolean;
  includeImages?: boolean;
  includeImageDescriptions?: boolean;
  topic?: "general" | "news" | "finance";
  timeRange?: "day" | "week" | "month" | "year";
}

export interface TavilyExtractResult {
  url: string;
  raw_content: string;
  images: string[];
}

export interface TavilyFailedResult {
  url: string;
  error: string;
}

export interface TavilyExtractResponse {
  results: TavilyExtractResult[];
  failed_results: TavilyFailedResult[];
  response_time: number;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content: string | null;
}

export interface TavilySearchResponse {
  query: string;
  follow_up_questions: string[] | null;
  answer: string | null;
  images: string[];
  results: TavilySearchResult[];
  response_time: number;
}

export class TavilySearchAPIWrapper {
  tavilyApiKey?: string;

  constructor(fields: { tavilyApiKey?: string }) {
    const apiKey =
      fields.tavilyApiKey ?? getEnvironmentVariable("TAVILY_API_KEY");
    if (!apiKey) {
      throw new Error(
        "Tavily API key not found. Please provide it as an argument or set the TAVILY_API_KEY environment variable."
      );
    }
    this.tavilyApiKey = apiKey;
  }

  async rawResults(params: TavilySearchParams): Promise<TavilySearchResponse> {
    const headers = {
      Authorization: `Bearer ${this.tavilyApiKey}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(`${TAVILY_BASE_URL}/search`, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
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

export class TavilyExtractAPIWrapper {
  tavilyApiKey?: string;

  constructor(fields: { tavilyApiKey?: string }) {
    const apiKey =
      fields.tavilyApiKey ?? getEnvironmentVariable("TAVILY_API_KEY");
    if (!apiKey) {
      throw new Error(
        "Tavily API key not found. Please provide it as an argument or set the TAVILY_API_KEY environment variable."
      );
    }
    this.tavilyApiKey = apiKey;
  }

  async rawResults(
    params: TavilyExtractParams
  ): Promise<TavilyExtractResponse> {
    const headers = {
      Authorization: `Bearer ${this.tavilyApiKey}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(`${TAVILY_BASE_URL}/extract`, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.detail?.error || "Unknown error";
      throw new Error(`Error ${response.status}: ${errorMessage}`);
    }

    return response.json();
  }
}
