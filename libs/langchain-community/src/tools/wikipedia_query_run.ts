import { Tool } from "@langchain/core/tools";

/**
 * Interface for the parameters that can be passed to the
 * WikipediaQueryRun constructor.
 */
export interface WikipediaQueryRunParams {
  topKResults?: number;
  maxDocContentLength?: number;
  baseUrl?: string;
}

/**
 * Type alias for URL parameters. Represents a record where keys are
 * strings and values can be string, number, boolean, undefined, or null.
 */
type UrlParameters = Record<
  string,
  string | number | boolean | undefined | null
>;

/**
 * Interface for the structure of search results returned by the Wikipedia
 * API.
 */
interface SearchResults {
  query: {
    search: Array<{
      title: string;
    }>;
  };
}

/**
 * Interface for the structure of a page returned by the Wikipedia API.
 */
interface Page {
  pageid: number;
  ns: number;
  title: string;
  extract: string;
}

/**
 * Interface for the structure of a page result returned by the Wikipedia
 * API.
 */
interface PageResult {
  batchcomplete: string;
  query: {
    pages: Record<string, Page>;
  };
}

/**
 * Class for interacting with and fetching data from the Wikipedia API. It
 * extends the Tool class.
 * @example
 * ```typescript
 * const wikipediaQuery = new WikipediaQueryRun({
 *   topKResults: 3,
 *   maxDocContentLength: 4000,
 * });
 * const result = await wikipediaQuery.call("Langchain");
 * ```
 */
export class WikipediaQueryRun extends Tool {
  static lc_name() {
    return "WikipediaQueryRun";
  }

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

  /**
   * Fetches the content of a specific Wikipedia page. It returns the
   * extracted content as a string.
   * @param page The specific Wikipedia page to fetch its content.
   * @param redirect A boolean value to indicate whether to redirect or not.
   * @returns The extracted content of the specific Wikipedia page as a string.
   */
  public async content(page: string, redirect = true): Promise<string> {
    try {
      const result = await this._fetchPage(page, redirect);
      return result.extract;
    } catch (error) {
      throw new Error(`Failed to fetch content for page "${page}": ${error}`);
    }
  }

  /**
   * Builds a URL for the Wikipedia API using the provided parameters.
   * @param parameters The parameters to be used in building the URL.
   * @returns A string representing the built URL.
   */
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
