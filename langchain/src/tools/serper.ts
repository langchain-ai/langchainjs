import { Tool } from "./base.js";

export type SerperParameters = {
  gl?: string;
  hl?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SerperResponseExtractor = (response: any) => Promise<string>;

/**
 * Wrapper around serper.
 *
 * You can create a free API key at https://serper.dev.
 *
 * To use, you should have the SERPER_API_KEY environment variable set.
 */
export class Serper extends Tool {
  protected key: string;

  protected params: Partial<SerperParameters>;

  protected responseExtractor: SerperResponseExtractor;

  constructor(
    apiKey: string | undefined = typeof process !== "undefined"
      ? // eslint-disable-next-line no-process-env
        process.env?.SERPER_API_KEY
      : undefined,
    params: Partial<SerperParameters> = {},
    responseExtractor: SerperResponseExtractor = defaultResponseExtractor
  ) {
    super();

    if (!apiKey) {
      throw new Error(
        "Serper API key not set. You can set it as SERPER_API_KEY in your .env file, or pass it to Serper."
      );
    }

    this.key = apiKey;
    this.params = params;
    this.responseExtractor = responseExtractor;
  }

  name = "search";

  /** @ignore */
  async _call(input: string) {
    const options = {
      method: "POST",
      headers: {
        "X-API-KEY": this.key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: input,
        ...this.params,
      }),
    };

    const res = await fetch("https://google.serper.dev/search", options);

    if (!res.ok) {
      throw new Error(`Got ${res.status} error from serper: ${res.statusText}`);
    }

    const json = await res.json();

    return await this.responseExtractor(json);
  }

  description =
    "a search engine. useful for when you need to answer questions about current events. input should be a search query.";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function defaultResponseExtractor(json: any) {
  if (json.answerBox?.answer) {
    return json.answerBox.answer;
  }

  if (json.answerBox?.snippet) {
    return json.answerBox.snippet;
  }

  if (json.answerBox?.snippet_highlighted_words) {
    return json.answerBox.snippet_highlighted_words[0];
  }

  if (json.sportsResults?.game_spotlight) {
    return json.sportsResults.game_spotlight;
  }

  if (json.knowledgeGraph?.description) {
    return json.knowledgeGraph.description;
  }

  if (json.organic?.[0]?.snippet) {
    return json.organic[0].snippet;
  }

  return "No good search result found";
}
