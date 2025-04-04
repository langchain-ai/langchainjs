import { Hyperbrowser } from "@hyperbrowser/sdk";
import type { CreateSessionParams } from "@hyperbrowser/sdk/types";
import { ScrapeJobData, CrawledPage } from "@hyperbrowser/sdk/types";
import { Document, type DocumentInterface } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";

/**
 * Interface representing the parameters for the Hyperbrowser loader.
 */
interface HyperbrowserLoaderParameters {
  /**
   * URL to scrape or crawl
   */
  url: string;

  /**
   * API key for Hyperbrowser. If not provided, the default value is the value of the HYPERBROWSER_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Mode of operation. Can be "crawl" or "scrape".
   */
  mode?: "crawl" | "scrape";

  /**
   * Maximum number of pages to crawl (only applicable in crawl mode)
   */
  maxPages?: number;

  /**
   * Format of the output. Can be "markdown", "html", "links", or "screenshot"
   */
  outputFormat?: Array<"markdown" | "html" | "links" | "screenshot">;

  /**
   * Session options for the browser
   */
  sessionOptions?: {
    useProxy: boolean;
    solveCaptchas: boolean;
    acceptCookies: boolean;
    useStealth: boolean;
  };
}

/**
 * Class representing a document loader for loading data from Hyperbrowser.
 * It extends the BaseDocumentLoader class.
 * @example
 * ```typescript
 * const loader = new HyperbrowserLoader({
 *   url: "https://example.com",
 *   apiKey: "your-api-key",
 *   mode: "scrape",
 *   outputFormat: ["markdown"]
 * });
 * const docs = await loader.load();
 * ```
 */
export class HyperbrowserLoader extends BaseDocumentLoader {
  private apiKey: string;
  private url: string;
  private mode: "crawl" | "scrape";
  private maxPages: number;
  private outputFormat: Array<"markdown" | "html" | "links" | "screenshot">;
  private sessionOptions?: CreateSessionParams;

  constructor(params: HyperbrowserLoaderParameters) {
    super();

    const {
      apiKey = getEnvironmentVariable("HYPERBROWSER_API_KEY"),
      url,
      mode = "scrape",
      maxPages = 10,
      outputFormat = ["markdown"],
      sessionOptions,
    } = params;

    if (!apiKey) {
      throw new Error(
        "Hyperbrowser API key not set. You can set it as HYPERBROWSER_API_KEY in your .env file, or pass it to HyperbrowserLoader."
      );
    }

    this.apiKey = apiKey;
    this.url = url;
    this.mode = mode;
    this.maxPages = maxPages;
    this.outputFormat = outputFormat;
    this.sessionOptions = sessionOptions;
  }

  /**
   * Loads data from Hyperbrowser.
   * @returns An array of Documents representing the retrieved data.
   */
  public async load(): Promise<DocumentInterface[]> {
    const client = new Hyperbrowser({ apiKey: this.apiKey });

    try {
      if (this.mode === "scrape") {
        const response = await client.scrape.startAndWait({
          url: this.url,
          scrapeOptions: {
            formats: this.outputFormat,
          },
          sessionOptions: this.sessionOptions,
        });

        if (response.error) {
          throw new Error(
            `Hyperbrowser: Failed to scrape URL. Error: ${response.error}`
          );
        }

        if (!response.data) {
          return [];
        }

        return [
          new Document({
            pageContent: this.extractContent(response.data),
            metadata: {
              source: this.url,
              ...response.data?.metadata,
            },
          }),
        ];
      } else if (this.mode === "crawl") {
        const response = await client.crawl.startAndWait({
          url: this.url,
          maxPages: this.maxPages,
          scrapeOptions: {
            formats: this.outputFormat,
          },
          sessionOptions: this.sessionOptions,
        });

        if (response.error) {
          throw new Error(
            `Hyperbrowser: Failed to crawl URL. Error: ${response.error}`
          );
        }

        return (response.data || []).map(
          (page) =>
            new Document({
              pageContent: this.extractContent(page),
              metadata: {
                source: page.url || this.url,
                pageMeta: page.metadata,
              },
            })
        );
      }

      throw new Error(
        `Unrecognized mode '${this.mode}'. Expected one of 'crawl', 'scrape'.`
      );
    } catch (error: any) {
      throw new Error(
        `Failed to load data from Hyperbrowser: ${
          error.message || JSON.stringify(error)
        }`
      );
    }
  }

  private extractContent(data: ScrapeJobData | CrawledPage[]): string {
    if (!data) return "";
    // If it's an array (like in crawl results), join the content
    if (Array.isArray(data)) {
      return data
        .map((item) => this.extractContent(item))
        .filter(Boolean)
        .join("\n\n");
    }

    // Prioritize markdown over HTML over raw content
    if (data.markdown) return data.markdown;
    if (data.html) return data.html;
    if (typeof data === "string") return data;

    // If it's an object, stringify it
    return JSON.stringify(data);
  }
}
