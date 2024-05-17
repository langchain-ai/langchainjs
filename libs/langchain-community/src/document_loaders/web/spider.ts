import { Spider } from "@spider-cloud/spider-client";
import { Document, type DocumentInterface } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";

/**
 * Interface representing the parameters for the Spider loader. It
 * includes properties such as the URL to scrape or crawl and the API key.
 */
interface SpiderLoaderParameters {
  /**
   * URL to scrape or crawl
   */
  url: string;

  /**
   * API key for Spider. If not provided, the default value is the value of the SPIDER_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Mode of operation. Can be either "crawl" or "scrape". If not provided, the default value is "scrape".
   */
  mode?: "crawl" | "scrape";
  params?: Record<string, unknown>;
}
interface SpiderDocument {
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * Class representing a document loader for loading data from
 * Spider (spider.cloud). It extends the BaseDocumentLoader class.
 * @example
 * ```typescript
 * const loader = new SpiderLoader({
 *   url: "{url}",
 *   apiKey: "{apiKey}",
 *   mode: "crawl"
 * });
 * const docs = await loader.load();
 * ```
 */
export class SpiderLoader extends BaseDocumentLoader {
  private apiKey: string;

  private url: string;

  private mode: "crawl" | "scrape";

  private params?: Record<string, unknown>;

  constructor(loaderParams: SpiderLoaderParameters) {
    super();
    const {
      apiKey = getEnvironmentVariable("SPIDER_API_KEY"),
      url,
      mode = "scrape",
      params,
    } = loaderParams;
    if (!apiKey) {
      throw new Error(
        "Spider API key not set. You can set it as SPIDER_API_KEY in your .env file, or pass it to Spider."
      );
    }

    this.apiKey = apiKey;
    this.url = url;
    this.mode = mode;
    this.params = params || { metadata: true, return_format: "markdown" };
  }

  /**
   * Loads the data from the Spider.
   * @returns An array of Documents representing the retrieved data.
   * @throws An error if the data could not be loaded.
   */
  public async load(): Promise<DocumentInterface[]> {
    const app = new Spider({ apiKey: this.apiKey });
    let spiderDocs: SpiderDocument[];

    if (this.mode === "scrape") {
      const response = await app.scrapeUrl(this.url, this.params);
      if (response.error) {
        throw new Error(
          `Spider: Failed to scrape URL. Error: ${response.error}`
        );
      }
      spiderDocs = response as SpiderDocument[];
    } else if (this.mode === "crawl") {
      const response = await app.crawlUrl(this.url, this.params);
      if (response.error) {
        throw new Error(
          `Spider: Failed to crawl URL. Error: ${response.error}`
        );
      }
      spiderDocs = response as SpiderDocument[];
    } else {
      throw new Error(
        `Unrecognized mode '${this.mode}'. Expected one of 'crawl', 'scrape'.`
      );
    }

    return spiderDocs.map(
      (doc) =>
        new Document({
          pageContent: doc.content || "",
          metadata: doc.metadata || {},
        })
    );
  }
}
