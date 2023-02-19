import type { CheerioAPI, load as LoadT } from 'cheerio';
import { Document }  from '../docstore';
import { BaseDocumentLoader,  } from './base';
import type { DocumentLoader } from './base';

let load: typeof LoadT | null = null;

try {
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  ({ load } = require("cheerio"));
} catch {
  // ignore error, will be throw in constructor
}

export class CheerioWebBaseLoader extends BaseDocumentLoader implements DocumentLoader {
  web_path: string;

  constructor(web_path: string) {
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

    this.web_path = web_path;
  }

  async scrape(): Promise<CheerioAPI> {
    if (load === null) {
      throw new Error(
        "Please install cheerio as a dependency with, e.g. `yarn add cheerio`"
      );
    }

    const response = await fetch(this.web_path);
    const html = await response.text();
    return load(html);
  }

  async load(): Promise<Document[]> {
    const $ = await this.scrape();
    const text = $('body').text();
    const metadata = { source: this.web_path };
    return [new Document({ pageContent: text, metadata })];
  }
}
