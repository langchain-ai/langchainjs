import { getJson, GoogleParameters } from "serpapi";

import { Tool } from "./base";

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
        // eslint-disable-next-line max-len
        "SerpAPI API key not set. You can set it as SERPAPI_API_KEY in your .env file, or pass it to SerpAPI."
      );
    }

    this.key = apiKey;
    this.params = params;
  }

  name = "search";

  async call(input: string) {
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
    // eslint-disable-next-line max-len
    "a search engine. useful for when you need to answer questions about current events. input should be a search query.";
}
