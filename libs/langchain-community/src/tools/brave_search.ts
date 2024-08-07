import { Tool } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Interface for the parameters required to instantiate a BraveSearch
 * instance.
 */
export interface BraveSearchParams {
  apiKey?: string;
}

/**
 * Class for interacting with the Brave Search engine. It extends the Tool
 * class and requires an API key to function. The API key can be passed in
 * during instantiation or set as an environment variable named
 * 'BRAVE_SEARCH_API_KEY'.
 */
export class BraveSearch extends Tool {
  static lc_name() {
    return "BraveSearch";
  }

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
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(input)}`
    );
  
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second
    const backoffMultiplier = 2;
    let retryCount = 0;
  
    while (retryCount <= maxRetries) {
      try {
        const response = await fetch(searchUrl, { headers });
  
        if (!response.ok) {
          if (response.status === 429) {
            let waitTime = baseDelay * Math.pow(backoffMultiplier, retryCount);
            const rateLimitReset = response.headers.get("X-RateLimit-Reset");
            if (rateLimitReset) {
              waitTime = parseInt(rateLimitReset, 10) * 1000; // Convert seconds to milliseconds
            }
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            retryCount++;
            continue;
          }
          throw new Error(`HTTP error ${response.status}`);
        }
  
        const parsedResponse = await response.json();
        const webSearchResults = parsedResponse.web?.results;
        const finalResults = Array.isArray(webSearchResults)
          ? webSearchResults.map((item: { title?: string; url?: string; description?: string }) => ({
              title: item.title,
              link: item.url,
              snippet: item.description,
            }))
          : [];
        return JSON.stringify(finalResults);
      } catch (error) {
        if (retryCount >= maxRetries) {
          throw new Error(`Failed after ${maxRetries} retries: ${error}`);
        }
        retryCount++;
        const waitTime = baseDelay * Math.pow(backoffMultiplier, retryCount);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
    throw new Error("Unexpected error in _call method.");
  }
}
