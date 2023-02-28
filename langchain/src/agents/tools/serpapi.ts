import type { getJson as GetJsonT, GoogleParameters } from "serpapi";

import { Tool } from "./base.js";

/**
 * Wrapper around SerpAPI.
 *
 * To use, you should have the `serpapi` package installed and the SERPAPI_API_KEY environment variable set.
 */
export class SerpAPI extends Tool {
  protected key: string;

  protected params: Partial<GoogleParameters>;

  constructor(
    apiKey: string | undefined = process.env.SERPAPI_API_KEY,
    params: Partial<GoogleParameters> = {}
  ) {
    super();

    if (!apiKey) {
      throw new Error(
        "SerpAPI API key not set. You can set it as SERPAPI_API_KEY in your .env file, or pass it to SerpAPI."
      );
    }

    this.key = apiKey;
    this.params = params;
  }

  name = "search";

  /**
   * Run query through SerpAPI and parse result
   */
  async call(input: string) {
    const { getJson } = await SerpAPI.imports();
    const res = await getJson("google", {
      ...this.params,
      api_key: this.key,
      q: input,
    });

    if (res.error) {
      throw new Error(`Got error from serpAPI: ${res.error}`);
    }

    if (res.answer_box?.answer) {
      return res.answer_box.answer;
    }

    if (res.answer_box?.snippet) {
      return res.answer_box.snippet;
    }

    if (res.answer_box?.snippet_highlighted_words) {
      return res.answer_box.snippet_highlighted_words[0];
    }

    if (res.sports_results?.game_spotlight) {
      return res.sports_results.game_spotlight;
    }

    if (res.knowledge_graph?.description) {
      return res.knowledge_graph.description;
    }

    if (res.organic_results?.[0]?.snippet) {
      return res.organic_results[0].snippet;
    }

    return "No good search result found";
  }

  description =
    "a search engine. useful for when you need to answer questions about current events. input should be a search query.";

  static async imports(): Promise<{
    getJson: typeof GetJsonT;
  }> {
    try {
      const { getJson } = await import("serpapi");
      return { getJson };
    } catch (e) {
      throw new Error(
        "Please install serpapi as a dependency with, e.g. `yarn add serpapi`"
      );
    }
  }
}
