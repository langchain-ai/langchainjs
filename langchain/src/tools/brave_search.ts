import { getEnvironmentVariable } from "../util/env.js";
import { Tool } from "./base.js";

export interface BraveSearchParams {
  apiKey?: string;
}

export class BraveSearch extends Tool {
  name = "brave-search";

  description =
    "a search engine. useful for when you need to answer questions about current events. input should be a search query.";

  apiKey: string;

  constructor(
    fields: BraveSearchParams = {
      apiKey: getEnvironmentVariable("BRAVE_SEARCH_API_KEY"),
    }
  ) {
    super();

    if (!fields.apiKey) {
      throw new Error(
        `Brave API key not set. Please pass it in or set it as an environment variable named "BRAVE_SEARCH_API_KEY".`
      );
    }

    this.apiKey = fields.apiKey;
  }

  /** @ignore */
  async _call(input: string): Promise<string> {
    const headers = {
      "X-Subscription-Token": this.apiKey,
      Accept: "application/json",
    };
    const searchUrl = new URL(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
        input
      )}`
    );

    const response = await fetch(searchUrl, { headers });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const parsedResponse = await response.json();
    const webSearchResults = parsedResponse.web?.results;
    const finalResults = Array.isArray(webSearchResults)
      ? webSearchResults.map(
          (item: { title?: string; url?: string; description?: string }) => ({
            title: item.title,
            link: item.url,
            snippet: item.description,
          })
        )
      : [];
    return JSON.stringify(finalResults);
  }
}
