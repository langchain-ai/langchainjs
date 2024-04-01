import { Tool } from "@langchain/core/tools";
import { search, SearchOptions } from "duck-duck-scrape";

/**
 * Class for interacting with the DuckDuckGoSearch engine
 * It extends the base Tool class and implements the _call method to
 * perform the retrieve operation.
 *
 */

export {
  SafeSearchType,
  SearchOptions,
  SearchTimeType,
} from "duck-duck-scrape";

export interface DuckDuckGoSearchParameters {
  /**
   * The search options for the search using the SearchOptions interface
   * from the duck-duck-scrape package.
   * */

  searchOptions?: SearchOptions;
  /**
   * @default 10
   * The maximum number of results to return from the search. 
   * Limiting to 10 to avoid context overload.
   * */
  maxResults?: number;
}

const DEFAULT_MAX_RESULTS = 10;

export class DuckDuckGoSearch extends Tool {
  private searchOptions?: SearchOptions;

  private maxResults?: number;

  constructor(params? : DuckDuckGoSearchParameters) {
    super();
    if (params) {
      const { searchOptions, maxResults } = params;

      this.searchOptions = searchOptions;
      this.maxResults = maxResults || DEFAULT_MAX_RESULTS;
    } else {
      this.maxResults = DEFAULT_MAX_RESULTS;
    }
  }

  static lc_name() {
    return "DuckDuckGoSearch";
  }

  name = "duckduckgo-search";

  description =
    "a search engine. useful for when you need to answer questions about current events. input should be a search query.";

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
