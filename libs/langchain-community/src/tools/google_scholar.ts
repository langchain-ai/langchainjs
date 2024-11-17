import { Tool } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import fetch from "node-fetch"; // For making HTTP requests

/**
 * Interface for parameters required by GoogleScholarAPI class.
 */
export interface GoogleScholarAPIParams {
  apiKey?: string;
}

/**
 * Tool that queries Google Scholar using SerpApi
 */
export class GoogleScholarAPI extends Tool {
  static lc_name() {
    return "GoogleScholarAPI";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "SERP_API_KEY",
    };
  }

  name = "google_scholar";

  protected apiKey: string;

  description = `A wrapper around Google Scholar API via SerpApi. Useful for querying academic 
  articles and papers by keywords or authors. Input should be a search query string.`;

  constructor(fields?: GoogleScholarAPIParams) {
    super(...arguments);
    const apiKey =
      fields?.apiKey ?? getEnvironmentVariable("SERP_API_KEY");
    if (!apiKey) {
      throw new Error(
        `SerpApi key not set. You can set it as "SERP_API_KEY" in your environment variables.`
      );
    }
    this.apiKey = apiKey;
  }

  /**
   * Makes a request to SerpApi for Google Scholar results.
   * @param input - Search query string.
   * @returns A JSON string containing the search results.
   */
  async _call(input: string): Promise<string> {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(
      input
    )}&engine=google_scholar&api_key=${this.apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      let message;
      try {
        const json = await response.json();
        message = json.error;
      } catch (error) {
        message =
          "Unable to parse error message: SerpApi did not return a JSON response.";
      }
      throw new Error(
        `Got ${response.status}: ${response.statusText} error from SerpApi: ${message}`
      );
    }

    const json = await response.json();

    const results =
      json.scholar_results?.map((item: any) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        publication_info: item.publication_info?.summary,
        authors: item.authors?.map((author: any) => author.name).join(", "),
      })) ?? [];

    return JSON.stringify(results, null, 2);
  }
}
