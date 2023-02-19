import { Document } from "../docstore";
import { CheerioWebBaseLoader } from "./cheerio_web_base";

export class IMSDbLoader extends CheerioWebBaseLoader {
  constructor(web_path: string) {
    super(web_path);
  }

  public async load(): Promise<Document[]> {
    const $ = await this.scrape();
    const text = $("td[class='scrtext']").text().trim();
    const metadata = { source: this.web_path };
    return [new Document({ pageContent: text, metadata })];
  }
}
