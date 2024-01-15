import { extract_from_url } from "@philschmid/clipper/dist/clipper.js";
import { crawl } from "@philschmid/clipper/dist/crawler.js";
import { Document, DocumentInterface } from "@langchain/core/documents";
import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import { BaseDocumentLoader } from "../base.js";
import type { DocumentLoader } from "../base.js";

/**
 * Represents the parameters for configuring the CheerioWebBaseLoader. It
 * extends the AsyncCallerParams interface and adds additional parameters
 * specific to web-based loaders.
 */
export interface WebBaseLoaderParams extends AsyncCallerParams {
  usePlaywrightCrawler?: boolean;
}

/**
 * A document loader that "clips" content from webpages and converts it to
 * markdown. The additional semantic information provided by the markdown
 * can allow for more self-contained chunks when combined with e.g.
 * a markdown specific text-splitter.
 * @example
 * ```typescript
 * const loader = new ClipperWebLoader("https://exampleurl.com");
 * const docs = await loader.load();
 * console.log({ docs });
 * ```
 */
export class ClipperWebLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  url: string;

  usePlaywrightCrawler = false;

  caller: AsyncCaller;

  constructor(url: string, fields?: WebBaseLoaderParams) {
    super();
    const { usePlaywrightCrawler, ...rest } = fields ?? {};
    this.url = url;
    this.usePlaywrightCrawler =
      usePlaywrightCrawler ?? this.usePlaywrightCrawler;
    this.caller = new AsyncCaller(rest);
  }

  /**
   * Extracts the text content from the loaded document using the selector
   * and creates a Document instance with the extracted text and metadata.
   * It returns an array of Document instances.
   * @returns A Promise that resolves to an array of Document instances.
   */
  async load(): Promise<DocumentInterface[]> {
    let method = extract_from_url.bind(null, this.url);
    if (this.usePlaywrightCrawler) {
      method = crawl.bind(null, this.url);
    }
    const res = await this.caller.call(method);
    return [
      new Document({
        pageContent: res,
        metadata: {
          source: this.url,
        },
      }),
    ];
  }
}
