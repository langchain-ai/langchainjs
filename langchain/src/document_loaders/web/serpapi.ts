import { getEnvironmentVariable } from "../../util/env.js";
import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";

/**
 * Interface representing the parameters for the SerpAPI loader. It
 * includes properties such as the search query and the API key.
 */
interface SerpAPIParameters {
  /**
   * Search Query
   */
  q: string;
  apiKey?: string;
}

/**
 * Class representing a document loader for loading search results from
 * the SerpAPI. It extends the BaseDocumentLoader class.
 * @example
 * ```typescript
 * const loader = new SerpAPILoader({ q: "{query}", apiKey: "{apiKey}" });
 * const docs = await loader.load();
 * ```
 */
export class SerpAPILoader extends BaseDocumentLoader {
  private apiKey: string;

  private searchQuery: string;

  constructor(params: SerpAPIParameters) {
    super();
    const { apiKey = getEnvironmentVariable("SERPAPI_API_KEY"), q } = params;
    if (!apiKey) {
      throw new Error(
        "SerpAPI API key not set. You can set it as SERPAPI_API_KEY in your .env file, or pass it to SerpAPI."
      );
    }

    this.apiKey = apiKey;
    this.searchQuery = q;
  }

  /**
   * Builds the URL for the SerpAPI search request.
   * @returns The URL for the search request.
   */
  public buildUrl(): string {
    const params = new URLSearchParams();
    params.append("api_key", this.apiKey);
    params.append("q", this.searchQuery);
    return `https://serpapi.com/search?${params.toString()}`;
  }

  /**
   * Extracts documents from the provided output.
   * @param output - The output to extract documents from.
   * @param responseType - The type of the response to extract documents from.
   * @returns An array of Documents.
   */
  private extractDocuments(output: unknown, responseType: string): Document[] {
    const documents: Document[] = [];
    const results = Array.isArray(output) ? output : [output];
    for (const result of results) {
      const pageContent = JSON.stringify(result);
      const metadata = {
        source: "SerpAPI",
        responseType,
      };
      documents.push(new Document({ pageContent, metadata }));
    }
    return documents;
  }

  /**
   * Processes the response data from the SerpAPI search request and converts it into an array of Documents.
   * @param data - The response data from the SerpAPI search request.
   * @returns An array of Documents.
   */
  public processResponseData(data: Record<string, unknown>): Document[] {
    const documents: Document[] = [];
    const responseTypes = [
      "answer_box",
      "sports_results",
      "shopping_results",
      "knowledge_graph",
      "organic_results",
    ];
    for (const responseType of responseTypes) {
      if (responseType in data) {
        documents.push(
          ...this.extractDocuments(data[responseType], responseType)
        );
      }
    }
    return documents;
  }

  /**
   * Fetches the data from the provided URL and returns it as a JSON object.
   * If an error occurs during the fetch operation, an exception is thrown with the error message.
   * @param url - The URL to fetch data from.
   * @returns A promise that resolves to the fetched data as a JSON object.
   * @throws An error if the fetch operation fails.
   */
  private async fetchData(url: string): Promise<Record<string, unknown>> {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(
        `Failed to load search results from SerpAPI due to: ${data.error}`
      );
    }

    return data;
  }

  /**
   * Loads the search results from the SerpAPI.
   * @returns An array of Documents representing the search results.
   * @throws An error if the search results could not be loaded.
   */
  public async load(): Promise<Document[]> {
    const url = this.buildUrl();

    const data = await this.fetchData(url);
    try {
      return this.processResponseData(data);
    } catch (error) {
      console.error(error);
      throw new Error(
        `Failed to process search results from SerpAPI: ${error}`
      );
    }
  }
}
