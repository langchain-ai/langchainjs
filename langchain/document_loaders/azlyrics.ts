import { Document } from "../document";
import { CheerioWebBaseLoader } from "./cheerio_web_base";

export class AZLyricsLoader extends CheerioWebBaseLoader {
  constructor(public webPath: string) {
    super(webPath);
  }

  public async load(): Promise<Document[]> {
    const $ = await this.scrape();
    const title = $("title").text();
    const lyrics = $("div[class='']").eq(2).text();
    const text = title + lyrics;
    const metadata = { source: this.webPath };
    return [new Document({ pageContent: text, metadata })];
  }
}
