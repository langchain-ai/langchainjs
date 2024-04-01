import { Tool, ToolParams } from "@langchain/core/tools";
import { search, SearchOptions } from "duck-duck-scrape";

export {
  SafeSearchType,
  SearchOptions,
  SearchTimeType,
} from "duck-duck-scrape";

export interface DuckDuckGoSearchParameters extends ToolParams {
  /**
   * The search options for the search using the SearchOptions interface
   * from the duck-duck-scrape package.
   */
  searchOptions?: SearchOptions;
  /**
   * The maximum number of results to return from the search.
   * Limiting to 10 to avoid context overload.
   * @default 10
   */
  maxResults?: number;
}

const DEFAULT_MAX_RESULTS = 10;

/**
 * Class for interacting with the DuckDuckGo search engine
 * It extends the base Tool class to perform retrieval.
 */
export class DuckDuckGoSearch extends Tool {
  private searchOptions?: SearchOptions;

  private maxResults = DEFAULT_MAX_RESULTS;

  constructor(params?: DuckDuckGoSearchParameters) {
    super(params ?? {});

    const { searchOptions, maxResults } = params ?? {};
    this.searchOptions = searchOptions;
    this.maxResults = maxResults || this.maxResults;
  }

  static lc_name() {
    return "DuckDuckGoSearch";
  }

  name = "duckduckgo-search";

  description =
    "A search engine. Useful for when you need to answer questions about current events. Input should be a search query.";

  async _call(input: string): Promise<string> {
    const { results } = await search(input, this.searchOptions);

    return JSON.stringify(
      results
        .map((result) => ({
          title: result.title,
          link: result.url,
          snippet: result.description,
        }))
        .slice(0, this.maxResults)
    );
  }
}
