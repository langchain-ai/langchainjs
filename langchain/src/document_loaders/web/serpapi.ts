import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";

interface ILoaderOptions {
  apiKey: string;

  searchQuery: string;

  responseTypes?: string[];
}

export class SerpAPILoader extends BaseDocumentLoader {
  private apiKey: string;

  private searchQuery: string;

  private responseTypes: string[];

  constructor({ apiKey, searchQuery, responseTypes }: ILoaderOptions) {
    super();

    this.apiKey = apiKey;
    this.searchQuery = searchQuery;
    this.responseTypes = responseTypes || [
      "answer_box",
      "sports_results",
      "shopping_results",
      "knowledge_graph",
      "organic_results",
    ];
  }

  public buildUrl(): string {
    return `https://serpapi.com/search?api_key=${
      this.apiKey
    }&q=${encodeURIComponent(this.searchQuery)}`;
  }

  public processResponseData(data: Record<string, unknown>): Document[] {
    const documents: Document[] = [];

    for (const responseType of this.responseTypes) {
      if (responseType in data) {
        const output = data[responseType];
        const results = Array.isArray(output) ? output : [output];
        for (const result of results) {
          const pageContent = JSON.stringify(result);
          const metadata = {
            source: "SerpAPI",
            responseType,
          };
          documents.push(new Document({ pageContent, metadata }));
        }
      }
    }

    return documents;
  }

  async load(): Promise<Document[]> {
    const url = this.buildUrl();

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        throw new Error(
          `Failed to load search results from SerpAPI due to: ${data.error}`
        );
      }

      return this.processResponseData(data);
    } catch (error) {
      console.error(error);
      throw new Error(`Failed to load search results from SerpAPI`);
    }
  }
}
