import { Document } from "../../document.js";
import { CheerioWebBaseLoader } from "./cheerio.js";

/**
 * A document loader specifically designed for loading documents from the
 * College Confidential website. It extends the CheerioWebBaseLoader.
 * @example
 * ```typescript
 * const loader = new CollegeConfidentialLoader("https:exampleurl.com");
 * const docs = await loader.load();
 * console.log({ docs });
 * ```
 */
export class CollegeConfidentialLoader extends CheerioWebBaseLoader {
  constructor(webPath: string) {
    super(webPath);
  }

  /**
   * Overrides the base load() method to extract the text content from the
   * loaded document using a specific selector for the College Confidential
   * website. It creates a Document instance with the extracted text and
   * metadata, and returns an array containing the Document instance.
   * @returns An array containing a Document instance with the extracted text and metadata from the loaded College Confidential web document.
   */
  public async load(): Promise<Document[]> {
    const $ = await this.scrape();
    const text = $("main[class='skin-handler']").text();
    const metadata = { source: this.webPath };
    return [new Document({ pageContent: text, metadata })];
  }
}
