import { Document } from "../document.js";
import { CheerioWebBaseLoader } from "./cheerio_web_base.js";

export class IMSDBLoader extends CheerioWebBaseLoader {
  constructor(public webPath: string) {
    super(webPath);
  }

  public async load(): Promise<Document[]> {
    const $ = await this.scrape();
    const text = $("td[class='scrtext']").text().trim();
    const metadata = { source: this.webPath };
    return [new Document({ pageContent: text, metadata })];
  }
}
