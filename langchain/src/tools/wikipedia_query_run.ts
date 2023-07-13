import { Tool } from "./base.js";

export interface WikipediaQueryRunParams {
  topKResults?: number;
  maxDocContentLength?: number;
  baseUrl?: string;
}

type UrlParameters = Record<
  string,
  string | number | boolean | undefined | null
>;

interface SearchResults {
  query: {
    search: Array<{
      title: string;
    }>;
  };
}

interface Page {
  pageid: number;
  ns: number;
  title: string;
  extract: string;
}

interface PageResult {
  batchcomplete: string;
  query: {
    pages: Record<string, Page>;
  };
}

export class WikipediaQueryRun extends Tool {
  name = "wikipedia-api";

  description =
    "A tool for interacting with and fetching data from the Wikipedia API.";

  protected topKResults = 3;

  protected maxDocContentLength = 4000;

  protected baseUrl = "https://en.wikipedia.org/w/api.php";

  constructor(params: WikipediaQueryRunParams = {}) {
    super();

    this.topKResults = params.topKResults ?? this.topKResults;
    this.maxDocContentLength =
      params.maxDocContentLength ?? this.maxDocContentLength;
    this.baseUrl = params.baseUrl ?? this.baseUrl;
  }

  async _call(query: string): Promise<string> {
    const searchResults = await this._fetchSearchResults(query);
    const summaries: string[] = [];

    for (
      let i = 0;
      i < Math.min(this.topKResults, searchResults.query.search.length);
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
      return summaries.join("\n\n").slice(0, this.maxDocContentLength);
    }
  }

  public async content(page: string, redirect = true): Promise<string> {
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

  private async _fetchSearchResults(query: string): Promise<SearchResults> {
    const searchParams = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      format: "json",
    });

    const response = await fetch(`${this.baseUrl}?${searchParams.toString()}`);
    if (!response.ok) throw new Error("Network response was not ok");

    const data: SearchResults = await response.json();

    return data;
  }

  private async _fetchPage(page: string, redirect: boolean): Promise<Page> {
    const params = new URLSearchParams({
      action: "query",
      prop: "extracts",
      explaintext: "true",
      redirects: redirect ? "1" : "0",
      format: "json",
      titles: page,
    });

    const response = await fetch(`${this.baseUrl}?${params.toString()}`);
    if (!response.ok) throw new Error("Network response was not ok");

    const data: PageResult = await response.json();
    const { pages } = data.query;
    const pageId = Object.keys(pages)[0];

    return pages[pageId];
  }
}
