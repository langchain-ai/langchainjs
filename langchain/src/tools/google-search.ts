import { customsearch_v1, google } from "googleapis";

/**
 * A wrapper class for the Google Custom Search API.
 */

class GoogleSearchAPIWrapper {
  private customSearch?: customsearch_v1.Customsearch;

  private getCx(): string {
    // eslint-disable-next-line no-process-env
    const cx = process.env.GOOGLE_CSE_ID || "";
    if (!cx) {
      throw new Error("Missing GOOGLE_CSE_ID environment variable.");
    }
    return cx;
  }

  private getApiKey(): string {
    // eslint-disable-next-line no-process-env
    const apiKey = process.env.GOOGLE_API_KEY || "";
    if (!apiKey) {
      throw new Error("Missing GOOGLE_API_KEY environment variable.");
    }
    return apiKey;
  }

  private getCustomSearch(): customsearch_v1.Customsearch {
    if (!this.customSearch) {
      const version = "v1";
      this.customSearch = google.customsearch(version);
    }
    return this.customSearch;
  }

  /**
   * Runs a search query through the Google Custom Search API.
   *
   * @param query The query to search for.
   * @returns A Promise that resolves to the search response object.
   * @throws An error if the search request fails.
   */

  async run(query: string): Promise<customsearch_v1.Schema$Search> {
    try {
      const response = await this.getCustomSearch().cse.list({
        q: query,
        cx: this.getCx(),
        auth: this.getApiKey(),
      });

      return response.data;
    } catch (error) {
      console.log(`Error searching Google: ${error}`);
      throw error;
    }
  }

  /**
   * Runs a search query through the Google Custom Search API and returns the metadata for the top search results.
   *
   * @param query The query to search for.
   * @param numResults The number of results to return.
   * @returns A Promise that resolves to an array of search result metadata objects.
   * @throws An error if the search request fails or if the `GOOGLE_API_KEY` or `GOOGLE_CSE_ID` environment variables are not set.
   */

  async results(
    query: string,
    numResults: number
  ): Promise<customsearch_v1.Schema$Result[]> {
    const metadataResults: customsearch_v1.Schema$Result[] = [];
    const response = await this.run(query);

    if (!response.items || response.items.length === 0) {
      return [{ title: "No good Google Search Result was found", link: "" }];
    }

    const results = response.items.slice(0, numResults);

    for (const result of results) {
      const metadataResult: customsearch_v1.Schema$Result = {
        title: result.title || "",
        link: result.link || "",
      };
      if (result.snippet) {
        metadataResult.snippet = result.snippet;
      }
      metadataResults.push(metadataResult);
    }

    return metadataResults;
  }
}

export default GoogleSearchAPIWrapper;
