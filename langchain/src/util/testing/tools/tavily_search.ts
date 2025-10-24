import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { Tool, type ToolParams } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Options for the TavilySearchResults tool.
 */
export type TavilySearchAPIRetrieverFields = ToolParams & {
  maxResults?: number;
  kwargs?: Record<string, unknown>;
  apiKey?: string;
};

/**
 * Tool for the Tavily search API.
 */
export class TavilySearchResults extends Tool {
  static lc_name(): string {
    return "TavilySearchResults";
  }

  description =
    "A search engine optimized for comprehensive, accurate, and trusted results. Useful for when you need to answer questions about current events. Input should be a search query.";

  name = "tavily_search_results_json";

  protected maxResults = 5;

  protected apiKey?: string;

  protected kwargs: Record<string, unknown> = {};

  constructor(fields?: TavilySearchAPIRetrieverFields) {
    super(fields);
    this.maxResults = fields?.maxResults ?? this.maxResults;
    this.kwargs = fields?.kwargs ?? this.kwargs;
    this.apiKey = fields?.apiKey ?? getEnvironmentVariable("TAVILY_API_KEY");
    if (this.apiKey === undefined) {
      throw new Error(
        `No Tavily API key found. Either set an environment variable named "TAVILY_API_KEY" or pass an API key as "apiKey".`
      );
    }
  }

  protected async _call(
    input: string,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    const body: Record<string, unknown> = {
      query: input,
      max_results: this.maxResults,
      api_key: this.apiKey,
    };

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...body, ...this.kwargs }),
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(
        `Request failed with status code ${response.status}: ${json.error}`
      );
    }
    if (!Array.isArray(json.results)) {
      throw new Error(`Could not parse Tavily results. Please try again.`);
    }
    return JSON.stringify(json.results);
  }
}
