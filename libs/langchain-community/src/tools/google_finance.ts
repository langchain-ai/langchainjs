import { Tool } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Interface for parameters required by the SERPGoogleFinanceAPITool class.
 */
export interface SERPGoogleFinanceAPIToolParams {
  /**
   * Optional API key for accessing the SerpApi service.
   */
  apiKey?: string;
}

/**
 * Tool for querying Google Finance using the SerpApi service.
 */
export class SERPGoogleFinanceAPITool extends Tool {
  static lc_name() {
    return "GoogleFinanceAPI";
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
  name = "google_finance";

  // The API key used for making requests to SerpApi.
  protected apiKey: string;

  /**
   * Description of the tool for usage documentation.
   */
  description = `A wrapper around Google Finance Search.
  Useful for when you need to get information about
  google search Finance from Google Finance.
  Input should be a search query that includes a stock ticker 
  (e.g. GOOG:NASDAQ). It provides detailed information on:
  - Stock summary 
  - Markets
  - Graph (price per minute)
  - Knowledge graph
  - News articles
  - Financials
  - Related searches that may be of interest `;

  /**
   * Constructs a new instance of SERPGoogleFinanceAPITool.
   * @param fields - Optional parameters including an API key.
   */
  constructor(fields?: SERPGoogleFinanceAPIToolParams) {
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
   * Makes a request to SerpApi for Google Finance results.
   * @param input - Search query string.
   * @returns A JSON string containing the search results.
   * @throws Error if the API request fails or returns an error.
   */
  async _call(input: string): Promise<string> {
    // Construct the URL for the API request.
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(
      input
    )}&engine=google_finance&api_key=${encodeURIComponent(this.apiKey)}`;

    // Make an HTTP GET request to the SerpApi service.
    const response = await fetch(url);

    // Handle non-OK responses by extracting the error message.
    if (!response.ok) {
      let message;
      try {
        const json = await response.json();
        message = json.error;
      } catch (error) {
        message =
          "Unable to parse error message: SerpApi did not return a JSON response.";
      }
      // Throw an error with detailed information about the failure.
      throw new Error(
        `Got ${response.status}: ${response.statusText} error from SerpApi: ${message}`
      );
    }

    // Parse the JSON response from SerpApi.
    const json = await response.json();

    // Remove metadata and search parameters from result.
    if (json.search_metadata) delete json.search_metadata;
    if (json.search_parameters) delete json.search_parameters;

    // Return the results as a formatted JSON string.
    return JSON.stringify(json, null, 2);
  }
}
