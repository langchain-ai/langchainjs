import fetch from "node-fetch";
import { Tool } from "./base";

class BingSerpAPI extends Tool {
  name = "bing-search";

  description =
    "a search engine. useful for when you need to answer questions about current events. input should be a search query.";

  key: string;

  params: Record<string, string>;

  constructor(
    apiKey: string | undefined = process.env.BingApiKey,
    params: Record<string, string> = {}
  ) {
    super();

    if (!apiKey) {
      throw new Error(
        "BingSerpAPI API key not set. You can set it as BingApiKey in your .env file."
      );
    }

    this.key = apiKey;
    this.params = params;
  }

  async call(input: string): Promise<string> {
    const headers = { "Ocp-Apim-Subscription-Key": this.key };
    const params = { q: input, textDecorations: "true", textFormat: "HTML" };
    const searchUrl = new URL("https://api.bing.microsoft.com/v7.0/search");

    Object.entries(params).forEach(([key, value]) => {
      searchUrl.searchParams.append(key, value);
    });

    const response = await fetch(searchUrl, { headers });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const res = await response.json();

    const myresponse = res.webPages.value[0].snippet;

    return myresponse;
  }
}

export { BingSerpAPI };
