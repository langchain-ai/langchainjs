import type { CheerioAPI, load as LoadT } from "cheerio";
import { Document } from "../document.js";
import { BaseDocumentLoader } from "./base.js";
import type { DocumentLoader } from "./base.js";

export class CheerioWebBaseLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  constructor(public webPath: string) {
    super();
  }

  static async _scrape(url: string): Promise<CheerioAPI> {
    const { load } = await CheerioWebBaseLoader.imports();
    const response = await fetch(url);
    const html = await response.text();
    return load(html);
  }

  async scrape(): Promise<CheerioAPI> {
    return CheerioWebBaseLoader._scrape(this.webPath);
  }

  async load(): Promise<Document[]> {
    const $ = await this.scrape();
    const text = $("body").text();
    const metadata = { source: this.webPath };
    return [new Document({ pageContent: text, metadata })];
  }

  static async imports(): Promise<{
    load: typeof LoadT;
  }> {
    try {
      const { load } = await import("cheerio");
      return { load };
    } catch (e) {
      console.error(e);
      throw new Error(
        "Please install cheerio as a dependency with, e.g. `yarn add cheerio`"
      );
    }
  }
}
