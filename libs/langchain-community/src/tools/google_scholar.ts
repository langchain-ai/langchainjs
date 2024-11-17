import { Tool } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Interface for parameters required by GoogleScholarAPI class.
 */
export interface GoogleScholarAPIParams {
  apiKey?: string;
}

/**
 * Tool that queries the Google Scholar API
 */
export class GoogleScholarAPI extends Tool {
  static lc_name() {
    return "GoogleScholarAPI";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "GOOGLE_SCHOLAR_API_KEY",
    };
  }

  name = "google_scholar";

  protected apiKey: string;

  description = `A wrapper around the Google Scholar API. Useful for searching academic papers or 
  articles by keywords or authors. Input should be a search query string.`;

  constructor(fields?: GoogleScholarAPIParams) {
    super(...arguments);
    const apiKey =
      fields?.apiKey ?? getEnvironmentVariable("GOOGLE_SCHOLAR_API_KEY");
    if (!apiKey) {
      throw new Error(
        `Google Scholar API key not set. You can set it as "GOOGLE_SCHOLAR_API_KEY" in your environment variables.`
      );
    }
    this.apiKey = apiKey;
  }

  /**
   * Makes an API call to Google Scholar.
   * @param input - Search query string.
   * @returns A JSON string containing the search results.
   */
  async _call(input: string): Promise<string> {
    const url = `https://scholar.googleapis.com/v1/search`; // Example API endpoint
    const body = {
      query: input,
      limit: 10, // Maximum number of results to return
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let message;
      try {
        const json = await response.json();
        message = json.error.message;
      } catch (error) {
        message =
          "Unable to parse error message: Google Scholar API did not return a JSON response.";
      }
      throw new Error(
        `Got ${response.status}: ${response.statusText} error from Google Scholar API: ${message}`
      );
    }

    const json = await response.json();

    const results = json.results?.map((item: any) => ({
      title: item.title,
      authors: item.authors?.join(", "),
      publicationDate: item.publication_date,
      abstract: item.abstract,
      link: item.link,
    })) ?? [];

    return JSON.stringify(results, null, 2);
  }
}
