import { Document } from "../../document.js";
import { CheerioWebBaseLoader } from "./cheerio.js";

/**
 * A class that extends the CheerioWebBaseLoader class. It represents a
 * loader for loading web pages from the IMSDB (Internet Movie Script
 * Database) website.
 */
export class IMSDBLoader extends CheerioWebBaseLoader {
  constructor(public webPath: string) {
    super(webPath);
  }

  /**
   * An asynchronous method that loads the web page using the scrape()
   * method inherited from the base class. It selects the element with the
   * class 'scrtext' using the $ function provided by Cheerio and extracts
   * the text content. It creates a Document instance with the text content
   * as the page content and the source as metadata. It returns an array
   * containing the Document instance.
   * @returns An array containing a Document instance.
   */
  public async load(): Promise<Document[]> {
    const $ = await this.scrape();
    const text = $("td[class='scrtext']").text().trim();
    const metadata = { source: this.webPath };
    return [new Document({ pageContent: text, metadata })];
  }
}
