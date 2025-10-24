import { htmlToText } from "html-to-text";
import { Document } from "@langchain/core/documents";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";

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
  expand?: string;
  maxRetries?: number;
}

/**
 * Interface representing a Confluence page.
 */
export interface ConfluencePage {
  id: string;
  title: string;
  type: string;
  body: {
    storage: {
      value: string;
    };
  };
  status: string;
  version?: {
    number: number;
    when: string;
    by: {
      displayName: string;
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

  public readonly maxRetries: number;

  /**
   * expand parameter for confluence rest api
   * description can be found at https://developer.atlassian.com/server/confluence/expansions-in-the-rest-api/
   */
  public readonly expand?: string;

  public readonly personalAccessToken?: string;

  constructor({
    baseUrl,
    spaceKey,
    username,
    accessToken,
    limit = 25,
    expand = "body.storage,version",
    personalAccessToken,
    maxRetries = 5,
  }: ConfluencePagesLoaderParams) {
    super();
    this.baseUrl = baseUrl;
    this.spaceKey = spaceKey;
    this.username = username;
    this.accessToken = accessToken;
    this.limit = limit;
    this.expand = expand;
    this.personalAccessToken = personalAccessToken;
    this.maxRetries = maxRetries;
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
   * @param options the extra options of the load function
   * @param options.limit The limit parameter to overwrite the size to fetch pages.
   * @param options.start The start parameter to set inital offset to fetch pages.
   * @returns Promise resolving to an array of Document instances.
   */
  public async load(options?: {
    start?: number;
    limit?: number;
  }): Promise<Document[]> {
    try {
      const pages = await this.fetchAllPagesInSpace(
        options?.start,
        options?.limit
      );
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
    let retryCounter = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      retryCounter += 1;
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
            `Failed to fetch ${url} from Confluence: ${response.status}. Retrying...`
          );
        }

        return await response.json();
      } catch (error) {
        if (retryCounter >= this.maxRetries)
          throw new Error(
            `Failed to fetch ${url} from Confluence (retry: ${retryCounter}): ${error}`
          );
      }
    }
  }

  /**
   * Recursively fetches all the pages in the specified space.
   * @param start The start parameter to paginate through the results.
   * @returns Promise resolving to an array of ConfluencePage objects.
   */
  private async fetchAllPagesInSpace(
    start = 0,
    limit = this.limit
  ): Promise<ConfluencePage[]> {
    const url = `${this.baseUrl}/rest/api/content?spaceKey=${this.spaceKey}&limit=${limit}&start=${start}&expand=${this.expand}`;
    const data = await this.fetchConfluenceData(url);

    if (data.size === 0) {
      return [];
    }

    const nextPageStart = start + data.size;
    const nextPageResults = await this.fetchAllPagesInSpace(
      nextPageStart,
      limit
    );

    return data.results.concat(nextPageResults);
  }

  /**
   * Creates a Document instance from a ConfluencePage object.
   * @param page The ConfluencePage object to convert.
   * @returns A Document instance.
   */
  private createDocumentFromPage(page: ConfluencePage): Document {
    const htmlContent = page.body.storage.value;

    // Handle both self-closing and regular macros for attachments and view-file
    const htmlWithoutOtherMacros = htmlContent.replace(
      /<ac:structured-macro\s+ac:name="(attachments|view-file)"[^>]*(?:\/?>|>.*?<\/ac:structured-macro>)/gs,
      "[ATTACHMENT]"
    );

    // Extract and preserve code blocks with unique placeholders
    const codeBlocks: { language: string; code: string }[] = [];
    const htmlWithPlaceholders = htmlWithoutOtherMacros.replace(
      /<ac:structured-macro.*?<ac:parameter ac:name="language">(.*?)<\/ac:parameter>.*?<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body><\/ac:structured-macro>/g,
      (_, language, code) => {
        const placeholder = `CODE_BLOCK_${codeBlocks.length}`;
        codeBlocks.push({ language, code: code.trim() });
        return `\n${placeholder}\n`;
      }
    );

    // Convert the HTML content to plain text
    let plainTextContent = htmlToText(htmlWithPlaceholders, {
      wordwrap: false,
      preserveNewlines: true,
    });

    // Reinsert code blocks with proper markdown formatting
    codeBlocks.forEach(({ language, code }, index) => {
      const placeholder = `CODE_BLOCK_${index}`;
      plainTextContent = plainTextContent.replace(
        placeholder,
        `\`\`\`${language}\n${code}\n\`\`\``
      );
    });

    // Remove empty lines
    const textWithoutEmptyLines = plainTextContent.replace(/^\s*[\r\n]/gm, "");

    // Rest of the method remains the same...
    return new Document({
      pageContent: textWithoutEmptyLines,
      metadata: {
        id: page.id,
        status: page.status,
        title: page.title,
        type: page.type,
        url: `${this.baseUrl}/spaces/${this.spaceKey}/pages/${page.id}`,
        version: page.version?.number,
        updated_by: page.version?.by?.displayName,
        updated_at: page.version?.when,
      },
    });
  }
}
