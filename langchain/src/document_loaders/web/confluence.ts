import { htmlToText } from "html-to-text";
import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";

/**
 * Interface representing the parameters for configuring the
 * ConfluencePagesLoader.
 */
export interface ConfluencePagesLoaderParams {
  baseUrl: string;
  spaceKey: string;
  username?: string;
  accessToken?: string;
  personalAccessToken?: string;
  limit?: number;
}

/**
 * Interface representing a Confluence page.
 */
export interface ConfluencePage {
  id: string;
  title: string;
  body: {
    storage: {
      value: string;
    };
  };
}

/**
 * Interface representing the response from the Confluence API.
 */
export interface ConfluenceAPIResponse {
  size: number;
  results: ConfluencePage[];
}

/**
 * Class representing a document loader for loading pages from Confluence.
 * @example
 * ```typescript
 * const loader = new ConfluencePagesLoader({
 *   baseUrl: "https:
 *   spaceKey: "~EXAMPLE362906de5d343d49dcdbae5dEXAMPLE",
 *   username: "your-username",
 *   accessToken: "your-access-token",
 * });
 * const documents = await loader.load();
 * console.log(documents);
 * ```
 */
export class ConfluencePagesLoader extends BaseDocumentLoader {
  public readonly baseUrl: string;

  public readonly spaceKey: string;

  public readonly username?: string;

  public readonly accessToken?: string;

  public readonly limit: number;

  public readonly personalAccessToken?: string;

  constructor({
    baseUrl,
    spaceKey,
    username,
    accessToken,
    limit = 25,
    personalAccessToken,
  }: ConfluencePagesLoaderParams) {
    super();
    this.baseUrl = baseUrl;
    this.spaceKey = spaceKey;
    this.username = username;
    this.accessToken = accessToken;
    this.limit = limit;
    this.personalAccessToken = personalAccessToken;
  }

  /**
   * Returns the authorization header for the request.
   * @returns The authorization header as a string, or undefined if no credentials were provided.
   */
  private get authorizationHeader(): string | undefined {
    if (this.personalAccessToken) {
      return `Bearer ${this.personalAccessToken}`;
    } else if (this.username && this.accessToken) {
      const authToken = Buffer.from(
        `${this.username}:${this.accessToken}`
      ).toString("base64");
      return `Basic ${authToken}`;
    }

    return undefined;
  }

  /**
   * Fetches all the pages in the specified space and converts each page to
   * a Document instance.
   * @returns Promise resolving to an array of Document instances.
   */
  public async load(): Promise<Document[]> {
    try {
      const pages = await this.fetchAllPagesInSpace();
      return pages.map((page) => this.createDocumentFromPage(page));
    } catch (error) {
      console.error("Error:", error);
      return [];
    }
  }

  /**
   * Fetches data from the Confluence API using the provided URL.
   * @param url The URL to fetch data from.
   * @returns Promise resolving to the JSON response from the API.
   */
  protected async fetchConfluenceData(
    url: string
  ): Promise<ConfluenceAPIResponse> {
    try {
      const initialHeaders: HeadersInit = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      const authHeader = this.authorizationHeader;
      if (authHeader) {
        initialHeaders.Authorization = authHeader;
      }

      const response = await fetch(url, {
        headers: initialHeaders,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${url} from Confluence: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to fetch ${url} from Confluence: ${error}`);
    }
  }

  /**
   * Recursively fetches all the pages in the specified space.
   * @param start The start parameter to paginate through the results.
   * @returns Promise resolving to an array of ConfluencePage objects.
   */
  private async fetchAllPagesInSpace(start = 0): Promise<ConfluencePage[]> {
    const url = `${this.baseUrl}/rest/api/content?spaceKey=${this.spaceKey}&limit=${this.limit}&start=${start}&expand=body.storage`;
    const data = await this.fetchConfluenceData(url);

    if (data.size === 0) {
      return [];
    }

    const nextPageStart = start + data.size;
    const nextPageResults = await this.fetchAllPagesInSpace(nextPageStart);

    return data.results.concat(nextPageResults);
  }

  /**
   * Creates a Document instance from a ConfluencePage object.
   * @param page The ConfluencePage object to convert.
   * @returns A Document instance.
   */
  private createDocumentFromPage(page: ConfluencePage): Document {
    // Convert the HTML content to plain text
    const plainTextContent = htmlToText(page.body.storage.value, {
      wordwrap: false,
      preserveNewlines: false,
    });

    // Remove empty lines
    const textWithoutEmptyLines = plainTextContent.replace(/^\s*[\r\n]/gm, "");

    // Generate the URL
    const pageUrl = `${this.baseUrl}/spaces/${this.spaceKey}/pages/${page.id}`;

    // Return a langchain document
    return new Document({
      pageContent: textWithoutEmptyLines,
      metadata: {
        title: page.title,
        url: pageUrl,
      },
    });
  }
}
