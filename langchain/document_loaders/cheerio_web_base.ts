import type { CheerioAPI, load as LoadT } from "cheerio";
import { Document } from "../document";
import { BaseDocumentLoader } from "./base";
import type { DocumentLoader } from "./base";

let load: typeof LoadT | null = null;

try {
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  ({ load } = require("cheerio"));
} catch {
  // ignore error, will be throw in constructor
}

export class CheerioWebBaseLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  constructor(public webPath: string) {
    super();

    /**
     * Throw error at construction time
     * if cheerio package is not installed.
     */
    if (load === null) {
      throw new Error(
        "Please install cheerio as a dependency with, e.g. `yarn add cheerio`"
      );
    }
  }

  static async _scrape(url: string): Promise<CheerioAPI> {
    if (load === null) {
      throw new Error(
        "Please install cheerio as a dependency with, e.g. `yarn add cheerio`"
      );
    }
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
}
