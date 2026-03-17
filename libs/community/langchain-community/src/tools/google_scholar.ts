import { Tool } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Interface for parameters required by the SERPGoogleScholarAPITool class.
 */
export interface GoogleScholarAPIParams {
  /**
   * Optional API key for accessing the SerpApi service.
   */
  apiKey?: string;
}

/**
 * Tool for querying Google Scholar using the SerpApi service.
 */
export class SERPGoogleScholarAPITool extends Tool {
  /**
   * Specifies the name of the tool, used internally by LangChain.
   */
  static lc_name() {
    return "SERPGoogleScholarAPITool";
  }

  /**
   * Returns a mapping of secret environment variable names to their usage in the tool.
   * @returns {object} Mapping of secret names to their environment variable counterparts.
   */
  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "SERPAPI_API_KEY",
    };
  }

  // Name of the tool, used for logging or identification within LangChain.
  name = "serp_google_scholar";

  // The API key used for making requests to SerpApi.
  protected apiKey: string;

  /**
   * Description of the tool for usage documentation.
   */
  description = `A wrapper around Google Scholar API via SerpApi. Useful for querying academic 
  articles and papers by keywords or authors. Input should be a search query string.`;

  /**
   * Constructs a new instance of SERPGoogleScholarAPITool.
   * @param fields - Optional parameters including an API key.
   */
  constructor(fields?: GoogleScholarAPIParams) {
    super(...arguments);

    // Retrieve API key from fields or environment variables.
    const apiKey = fields?.apiKey ?? getEnvironmentVariable("SERPAPI_API_KEY");

    // Throw an error if no API key is found.
    if (!apiKey) {
      throw new Error(
        `SerpApi key not set. You can set it as "SERPAPI_API_KEY" in your environment variables.`
      );
    }
    this.apiKey = apiKey;
  }

  /**
   * Makes a request to SerpApi for Google Scholar results.
   * @param input - Search query string.
   * @returns A JSON string containing the search results.
   * @throws Error if the API request fails or returns an error.
   */
  async _call(input: string): Promise<string> {
    // Construct the URL for the API request.
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(
      input
    )}&engine=google_scholar&api_key=${this.apiKey}`;

    // Make an HTTP GET request to the SerpApi service.
    const response = await fetch(url);

    // Handle non-OK responses by extracting the error message.
    if (!response.ok) {
      let message;
      try {
        const json = await response.json(); // Attempt to parse the error response.
        message = json.error; // Extract the error message from the response.
      } catch {
        // Handle cases where the response isn't valid JSON.
        message =
          "Unable to parse error message: SerpApi did not return a JSON response.";
      }
      // Throw an error with detailed information about the failure.
      throw new Error(
        `Got ${response.status}: ${response.statusText} error from SerpApi: ${message}`
      );
    }

    // Parse the JSON response from SerpApi.
    const json = (await response.json()) as {
      organic_results: {
        title: string;
        link: string;
        snippet: string;
        publication_info: { summary: string; authors: { name: string }[] };
        authors: { name: string }[];
        inline_links: { cited_by: { total: string } };
      }[];
    };

    // Transform the raw response into a structured format.
    const results =
      json.organic_results?.map((item) => ({
        title: item.title, // Title of the article or paper.
        link: item.link, // Direct link to the article or paper.
        snippet: item.snippet, // Brief snippet or description.
        publication_info:
          item.publication_info?.summary
            ?.split(" - ") // Split the summary at hyphens.
            .slice(1) // Remove the authors from the start of the string.
            .join(" - ") ?? "", // Rejoin remaining parts as publication info.
        authors:
          item.publication_info?.authors
            ?.map((author: { name: string }) => author.name) // Extract the list of author names.
            .join(", ") ?? "", // Join author names with a comma.
        total_citations: item.inline_links?.cited_by?.total ?? "", // Total number of citations.
      })) ?? `No results found for ${input} on Google Scholar.`;

    // Return the results as a formatted JSON string.
    return JSON.stringify(results, null, 2);
  }
}
