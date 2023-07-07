import { Tool } from "./base.js";

interface WikiPage {
  title: string;
  extract?: string;
  missing?: boolean;
}

interface WikiResponse {
  query: {
    search: { title: string }[];
    pages: { [key: string]: WikiPage };
  };
}

export interface WikipediaSearchParams {
  lang?: string;
  top_k_results?: number;
  doc_content_chars_max?: number;
}

export class WikipediaAPIWrapper extends Tool {
  name = "wikipedia-api-wrapper";

  description = "A tool for interacting with the Wikipedia API.";

  lang: string;

  top_k_results: number;

  doc_content_chars_max: number;

  apiUrl: string;

  constructor(lang = "en", params: WikipediaSearchParams = {}) {
    super();
    this.lang = params.lang || lang;
    this.top_k_results = params.top_k_results || 3;
    this.doc_content_chars_max = params.doc_content_chars_max || 4000;
    this.apiUrl = `https://${this.lang}.wikipedia.org/w/api.php`;
  }

  async _call(query: string): Promise<string> {
    const pageTitles = await this.search(query);
    const summaries = [];

    for (const pageTitle of pageTitles) {
      const pageContent = await this.getPageContent(pageTitle);
      if (pageContent) {
        summaries.push(this.formatSummary(pageTitle, pageContent));
      }
    }

    return summaries.join("\n\n").slice(0, this.doc_content_chars_max);
  }

  async search(query: string): Promise<string[]> {
    const params = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query.slice(0, 300),
      format: "json",
      utf8: "1",
    });

    const response = await fetch(`${this.apiUrl}?${params.toString()}`);
    const data: WikiResponse = await response.json();

    return data.query.search
      .map((item) => item.title)
      .slice(0, this.top_k_results);
  }

  async getPageContent(title: string): Promise<string | undefined> {
    const params = new URLSearchParams({
      action: "query",
      prop: "extracts",
      exintro: "1",
      explaintext: "1",
      titles: title,
      format: "json",
      utf8: "1",
    });

    const response = await fetch(`${this.apiUrl}?${params.toString()}`);
    const data: WikiResponse = await response.json();

    const page = Object.values(data.query.pages)[0];

    return !page.missing ? page.extract : undefined;
  }

  formatSummary(title: string, summary: string): string {
    return `Page: ${title}\nSummary: ${summary}`;
  }
}
