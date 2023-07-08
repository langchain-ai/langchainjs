import { Tool } from "./base.js";

export interface WikipediaAPIParams {
  top_k_results: number;
  doc_content_chars_max: number;
}

type UrlParameters = Record<
  string,
  string | number | boolean | undefined | null
>;

export class WikipediaAPIWrapper extends Tool {
  name = "wikipedia-api-wrapper";

  description = "A tool for interacting with the Wikipedia API.";

  protected params: WikipediaAPIParams;

  protected baseUrl: string;

  constructor(
    params: Partial<WikipediaAPIParams> = {},
    baseUrl = "https://en.wikipedia.org/w/api.php"
  ) {
    super();

    const defaultParams: WikipediaAPIParams = {
      top_k_results: 3,
      doc_content_chars_max: 4000,
    };

    this.params = { ...defaultParams, ...params };
    this.baseUrl = baseUrl;
  }

  async _call(query: string): Promise<string> {
    const searchResults = await this._fetchSearchResults(query);
    const summaries: string[] = [];

    for (
      let i = 0;
      i <
      Math.min(this.params.top_k_results, searchResults.query.search.length);
      i += 1
    ) {
      const page = searchResults.query.search[i].title;
      const pageDetails = await this._fetchPage(page, true);

      if (pageDetails) {
        const summary = `Page: ${page}\nSummary: ${pageDetails.extract}`;
        summaries.push(summary);
      }
    }

    if (summaries.length === 0) {
      return "No good Wikipedia Search Result was found";
    } else {
      return summaries.join("\n\n").slice(0, this.params.doc_content_chars_max);
    }
  }

  public async content(page: string, redirect = true): Promise<any> {
    try {
      const result = await this._fetchPage(page, redirect);
      return result.extract;
    } catch (error) {
      throw new Error(`Failed to fetch content for page "${page}": ${error}`);
    }
  }

  protected buildUrl<P extends UrlParameters>(parameters: P): string {
    const nonUndefinedParams: [string, string][] = Object.entries(parameters)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => [key, `${value}`]);
    const searchParams = new URLSearchParams(nonUndefinedParams);
    return `${this.baseUrl}?${searchParams}`;
  }

  private async _fetchSearchResults(query: string): Promise<any> {
    try {
      const searchParams = new URLSearchParams({
        action: "query",
        list: "search",
        srsearch: query,
        format: "json",
      });

      const response = await fetch(
        `${this.baseUrl}?${searchParams.toString()}`
      );
      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();

      return data;
    } catch (error) {
      console.error(
        "There has been a problem with your fetch operation: ",
        error
      );
      return null;
    }
  }

  private async _fetchPage(page: string, redirect: boolean): Promise<any> {
    try {
      const params = new URLSearchParams({
        action: "query",
        prop: "extracts",
        exintro: "true",
        explaintext: "true",
        redirects: redirect ? "1" : "0",
        format: "json",
        titles: page,
      });

      const response = await fetch(`${this.baseUrl}?${params.toString()}`);
      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();
      const {pages} = data.query;
      const pageId = Object.keys(pages)[0];

      return pages[pageId];
    } catch (error) {
      console.error(
        "There has been a problem with your fetch operation: ",
        error
      );
      return null;
    }
  }
}
