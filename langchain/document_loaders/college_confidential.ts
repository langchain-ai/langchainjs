import { Document } from "../docstore";
import { CheerioWebBaseLoader } from "./cheerio_web_base";

export class CollegeConfidentialLoader extends CheerioWebBaseLoader {
  constructor(web_path: string) {
    super(web_path);
  }

  public async load(): Promise<Document[]> {
    const $ = await this.scrape();
    const text = $("main[class='skin-handler']").text();
    const metadata = { source: this.web_path };
    return [new Document({ pageContent: text, metadata })];
  }
}
