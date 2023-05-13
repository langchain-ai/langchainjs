import { Tool } from "./base.js";

export interface GoogleSearchParams {
  apiKey: string;
  cx: string;
}

export class GoogleCustomSearch extends Tool {
  name = "google-custom-search";
  protected apiKey: string;
  protected cx: string;

  description =
    "a custom search engine. useful for when you need to answer questions about current events. input should be a search query.";

  constructor({ apiKey, cx }: GoogleSearchParams) {
    super();
    this.apiKey = apiKey;
    this.cx = cx;
  }
  async _call(input: string) {
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${this.apiKey}&cx=${
        this.cx
      }&q=${encodeURIComponent(input)}`
    );

    if (!res.ok) {
      throw new Error(
        `Got ${res.status} error from google custom search: ${res.statusText}`
      );
    }

    const json = await res.json();

    const results = json.items.map((item) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
    }));
    return JSON.stringify(results);
  }
}
