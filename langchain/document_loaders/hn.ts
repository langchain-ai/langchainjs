import type { CheerioAPI } from "cheerio";
import { Document } from "../document";
import { CheerioWebBaseLoader } from "./cheerio_web_base";

export class HNLoader extends CheerioWebBaseLoader {
  constructor(public webPath: string) {
    super(webPath);
  }

  public async load(): Promise<Document[]> {
    const $ = await this.scrape();
    if (this.webPath.includes("item")) {
      return this.loadComments($);
    }
    return this.loadResults($);
  }

  private loadComments($: CheerioAPI): Document[] {
    const comments = $("tr[class='athing comtr']");
    const title = $("tr[id='pagespace']").attr("title");
    const documents: Document[] = [];
    comments.each((_index, comment) => {
      const text = $(comment).text().trim();
      const metadata = { source: this.webPath, title };
      documents.push(new Document({ pageContent: text, metadata }));
    });
    return documents;
  }

  private loadResults($: CheerioAPI): Document[] {
    const items = $("tr[class='athing']");
    const documents: Document[] = [];
    items.each((_index, item) => {
      const ranking = $(item).find("span[class='rank']").text();
      const link = $(item).find("span[class='titleline'] a").attr("href");
      const title = $(item).find("span[class='titleline']").text().trim();
      const metadata = {
        source: this.webPath,
        title,
        link,
        ranking,
      };
      documents.push(new Document({ pageContent: title, metadata }));
    });
    return documents;
  }
}
