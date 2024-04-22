import FirecrawlApp from "@mendable/firecrawl-js";
import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { BaseDocumentLoader } from "../base.js";

/**
 * Interface representing the parameters for the Firecrawl loader. It
 * includes properties such as the URL to scrape or crawl and the API key.
 */
interface FirecrawlLoaderParameters {
  /**
   * URL to scrape or crawl
   */
  url: string;
  apiKey?: string;
  mode?: "crawl" | "scrape";
  params?: Record<string, unknown>;
}
interface FirecrawlDocument {
  markdown: string;
  metadata: Record<string, unknown>;
}
interface ScrapeResponse {
  success: boolean;
  data?: FirecrawlDocument;
  error?: string;
}
/**
 * Response interface for crawling operations.
 */
interface CrawlResponse {
  success: boolean;
  jobId?: string;
  data?: FirecrawlDocument[];
  error?: string;
}

/**
 * Class representing a document loader for loading data from
 * Firecrawl (firecrawl.dev). It extends the BaseDocumentLoader class.
 * @example
 * ```typescript
 * const loader = new FirecrawlLoader({ url: "{url}", apiKey: "{apiKey}", mode: "crawl" });
 * const docs = await loader.load();
 * ```
 */
export class FirecrawlLoader extends BaseDocumentLoader {
  private apiKey: string;

  private url: string;

  private mode: "crawl" | "scrape";

  private params?: Record<string, unknown>;

  constructor(loaderParams: FirecrawlLoaderParameters) {
    super();
    const {
      apiKey = getEnvironmentVariable("FIRECRAWL_API_KEY"),
      url,
      mode = "crawl",
      params,
    } = loaderParams;
    if (!apiKey) {
      throw new Error(
        "Firecrawl API key not set. You can set it as FIRECRAWL_API_KEY in your .env file, or pass it to Firecrawl."
      );
    }

    this.apiKey = apiKey;
    this.url = url;
    this.mode = mode;
    this.params = params;
  }

  /**
   * Loads the data from the Firecrawl.
   * @returns An array of Documents representing the retrieved data.
   * @throws An error if the data could not be loaded.
   */
  public async load(): Promise<Document[]> {
    const app = new FirecrawlApp({ apiKey: this.apiKey });
    let firecrawlDocs: FirecrawlDocument[];

    const processResponse = (
      response: ScrapeResponse | CrawlResponse
    ): FirecrawlDocument[] => {
      if (!response.success) {
        throw new Error(
          `Failed to ${this.mode} the URL using FirecrawlLoader. Error: ${response.error}`
        );
      }
      if (!response.data) {
        throw new Error(
          `Failed to ${this.mode} the URL using FirecrawlLoader. No data returned.`
        );
      }
      return this.mode === "scrape"
        ? ([response.data] as FirecrawlDocument[])
        : (response.data as FirecrawlDocument[]);
    };

    if (this.mode === "scrape") {
      firecrawlDocs = processResponse(
        await app.scrapeUrl(this.url, this.params)
      );
    } else if (this.mode === "crawl") {
      firecrawlDocs = processResponse(
        await app.crawlUrl(this.url, this.params, true)
      );
    } else {
      throw new Error(
        `Unrecognized mode '${this.mode}'. Expected one of 'crawl', 'scrape'.`
      );
    }

    return firecrawlDocs.map(
      (doc) =>
        new Document({
          pageContent: doc.markdown || "",
          metadata: doc.metadata || {},
        })
    );
  }
}
