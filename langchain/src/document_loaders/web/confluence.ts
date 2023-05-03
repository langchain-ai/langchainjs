import { htmlToText } from "html-to-text";
import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";

export interface ConfluencePagesLoaderParams {
  baseUrl: string;
  spaceKey: string;
  username: string;
  accessToken: string;
  limit?: number;
}

export interface ConfluencePage {
  id: string;
  title: string;
  body: {
    storage: {
      value: string;
    };
  };
}

export interface ConfluenceAPIResponse {
  size: number;
  results: ConfluencePage[];
}

export class ConfluencePagesLoader extends BaseDocumentLoader {
  public readonly baseUrl: string;

  public readonly spaceKey: string;

  public readonly username: string;

  public readonly accessToken: string;

  public readonly limit: number;

  constructor({
    baseUrl,
    spaceKey,
    username,
    accessToken,
    limit = 25,
  }: ConfluencePagesLoaderParams) {
    super();
    this.baseUrl = baseUrl;
    this.spaceKey = spaceKey;
    this.username = username;
    this.accessToken = accessToken;
    this.limit = limit;
  }

  public async load(): Promise<Document[]> {
    try {
      const pages = await this.fetchAllPagesInSpace();
      return pages.map((page) => this.createDocumentFromPage(page));
    } catch (error) {
      console.error("Error:", error);
      return [];
    }
  }

  protected async fetchConfluenceData(
    url: string
  ): Promise<ConfluenceAPIResponse> {
    try {
      const authToken = Buffer.from(
        `${this.username}:${this.accessToken}`
      ).toString("base64");

      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${authToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
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
