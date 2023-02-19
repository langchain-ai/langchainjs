import { Document } from "../docstore";
import { CheerioWebBaseLoader } from "./cheerio_web_base";

export class AZLyricsLoader extends CheerioWebBaseLoader {
  constructor(web_path: string) {
    super(web_path);
  }

  public async load(): Promise<Document[]> {
    const $ = await this.scrape();
    const title = $("title").text();
    const lyrics = $("div[class='']").eq(2).text();
    const text = title + lyrics;
    const metadata = { source: this.web_path };
    return [new Document({ pageContent: text, metadata })];
  }
}
