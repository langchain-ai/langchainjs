import FirecrawlApp from "@mendable/firecrawl-js";
import { Document, type DocumentInterface } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { BaseDocumentLoader } from "../base.js";
import { logVersion020MigrationWarning } from "../../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion020MigrationWarning({
  oldEntrypointName: "document_loaders/web/firecrawl",
  newPackageName: "@langchain/community",
});

/**
 * Interface representing the parameters for the Firecrawl loader. It
 * includes properties such as the URL to scrape or crawl and the API key.
 */
interface FirecrawlLoaderParameters {
  /**
   * URL to scrape or crawl
   */
  url: string;

  /**
   * API key for Firecrawl. If not provided, the default value is the value of the FIRECRAWL_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Mode of operation. Can be either "crawl" or "scrape". If not provided, the default value is "crawl".
   */
  mode?: "crawl" | "scrape";
  params?: Record<string, unknown>;
}
interface FirecrawlDocument {
  markdown: string;
  metadata: Record<string, unknown>;
}

/**
 * @deprecated - Import from "@langchain/community/document_loaders/web/firecrawl" instead. This entrypoint will be removed in 0.3.0.
 *
 * Class representing a document loader for loading data from
 * Firecrawl (firecrawl.dev). It extends the BaseDocumentLoader class.
 * @example
 * ```typescript
 * const loader = new FireCrawlLoader({
 *   url: "{url}",
 *   apiKey: "{apiKey}",
 *   mode: "crawl"
 * });
 * const docs = await loader.load();
 * ```
 */
export class FireCrawlLoader extends BaseDocumentLoader {
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
  public async load(): Promise<DocumentInterface[]> {
    const app = new FirecrawlApp({ apiKey: this.apiKey });
    let firecrawlDocs: FirecrawlDocument[];

    if (this.mode === "scrape") {
      const response = await app.scrapeUrl(this.url, this.params);
      if (!response.success) {
        throw new Error(
          `Firecrawl: Failed to scrape URL. Error: ${response.error}`
        );
      }
      firecrawlDocs = [response.data as FirecrawlDocument];
    } else if (this.mode === "crawl") {
      const response = await app.crawlUrl(this.url, this.params, true);
      firecrawlDocs = response as FirecrawlDocument[];
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
