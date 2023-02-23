import { Document } from "../document.js";
import { CheerioWebBaseLoader } from "./cheerio_web_base.js";

export class CollegeConfidentialLoader extends CheerioWebBaseLoader {
  constructor(webPath: string) {
    super(webPath);
  }

  public async load(): Promise<Document[]> {
    const $ = await this.scrape();
    const text = $("main[class='skin-handler']").text();
    const metadata = { source: this.webPath };
    return [new Document({ pageContent: text, metadata })];
  }
}
