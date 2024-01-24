import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { Tool, type ToolParams } from "@langchain/core/tools";
import Exa, { RegularSearchOptions } from "exa-js";

/**
 * Options for the ExaSearchResults tool.
 */
export type ExaSearchRetrieverFields = ToolParams & {
  client: Exa.default;
  searchArgs?: RegularSearchOptions;
};

/**
 * Tool for the Exa search API.
 */
export class ExaSearchResults extends Tool {
  static lc_name(): string {
    return "ExaSearchResults";
  }

  description =
    "A wrapper around Exa Search. Input should be an Exa-optimized query. Output is a JSON array of the query results";

  name = "exa_search_results_json";

  private client: Exa.default;

  searchArgs?: RegularSearchOptions;

  constructor(fields: ExaSearchRetrieverFields) {
    super(fields);
    this.client = fields.client;
    this.searchArgs = fields.searchArgs;
  }

  protected async _call(
    input: string,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    return JSON.stringify(
      await this.client.searchAndContents(input, this.searchArgs)
    );
  }
}

export class ExaFindSimilarResults extends Tool {
  static lc_name(): string {
    return "ExaFindSimilarResults";
  }

  description =
    "A wrapper around Exa Find Similar. Input should be an Exa-optimized query. Output is a JSON array of the query results";

  name = "exa_find_similar_results_json";

  private client: Exa.default;

  searchArgs?: RegularSearchOptions;

  constructor(fields: ExaSearchRetrieverFields) {
    super(fields);
    this.client = fields.client;
    this.searchArgs = fields.searchArgs;
  }

  protected async _call(
    url: string,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    return JSON.stringify(
      await this.client.findSimilarAndContents(url, this.searchArgs)
    );
  }
}
