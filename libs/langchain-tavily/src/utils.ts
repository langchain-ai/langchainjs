import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { z } from "zod";

const TAVILY_BASE_URL = "https://api.tavily.com";

const TavilyExtractParamsSchema = z.object({
  urls: z.array(z.string()),
  includeImages: z.boolean().optional(),
  extractDepth: z.enum(["basic", "advanced"]).optional(),
});

export const TavilySearchParamsSchema = z.object({
  query: z.string(),
  maxResults: z.number().int().positive().optional(),
  searchDepth: z.enum(["basic", "advanced"]).optional(),
  includeDomains: z.array(z.string()).optional(),
  excludeDomains: z.array(z.string()).optional(),
  includeAnswer: z.boolean().optional(),
  includeRawContent: z.boolean().optional(),
  includeImages: z.boolean().optional(),
  includeImageDescriptions: z.boolean().optional(),
  topic: z.enum(["general", "news", "finance"]).optional(),
  timeRange: z.enum(["day", "week", "month", "year"]).optional(),
});

export const TavilyExtractResponseSchema = z.object({
  results: z.array(
    z.object({
      url: z.string().url(),
      raw_content: z.string(),
      images: z.array(z.string().url()),
    })
  ),
  failed_results: z.array(
    z.object({
      url: z.string().url(),
      error: z.string(),
    })
  ),
  response_time: z.number().positive(),
});

export const TavilySearchResponseSchema = z.object({
  query: z.string(),
  follow_up_questions: z.array(z.string()).nullable(),
  answer: z.string().nullable(),
  images: z.array(z.string().url()),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string().url(),
      content: z.string(),
      score: z.number(),
      raw_content: z.string().nullable(),
    })
  ),
  response_time: z.number().positive(),
});

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

  async rawResults(
    params: z.infer<typeof TavilySearchParamsSchema>
  ): Promise<z.infer<typeof TavilySearchResponseSchema>> {
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
    params: z.infer<typeof TavilyExtractParamsSchema>
  ): Promise<z.infer<typeof TavilyExtractResponseSchema>> {
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
