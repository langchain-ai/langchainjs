import type { CheerioAPI } from "cheerio";
import { Document } from "../../document.js";
import { CheerioWebBaseLoader } from "./cheerio.js";

interface GitbookLoaderParams {
  shouldLoadAllPaths?: boolean;
}

export class GitbookLoader extends CheerioWebBaseLoader {
  shouldLoadAllPaths = false;

  constructor(public webPath: string, params: GitbookLoaderParams = {}) {
    const path =
      params.shouldLoadAllPaths === true ? `${webPath}/sitemap.xml` : webPath;
    super(path);

    this.webPath = path;

    this.shouldLoadAllPaths =
      params.shouldLoadAllPaths ?? this.shouldLoadAllPaths;
  }

  public async load(): Promise<Document[]> {
    const $ = await this.scrape();

    if (this.shouldLoadAllPaths === true) {
      return this.loadAllPaths($);
    }
    return this.loadPath($);
  }

  private loadPath($: CheerioAPI, url?: string): Document[] {
    const pageContent = $("main *")
      .contents()
      .toArray()
      .map((element) =>
        element.type === "text" ? $(element).text().trim() : null
      )
      .filter((text) => text)
      .join("\n");

    const title = $("main h1").first().text().trim();

    return [
      new Document({
        pageContent,
        metadata: { source: url ?? this.webPath, title },
      }),
    ];
  }

  private async loadAllPaths($: CheerioAPI): Promise<Document[]> {
    const urls = $("loc")
      .toArray()
      .map((element) => $(element).text());

    const documents: Document[] = [];
    for (const url of urls) {
      console.log(`Fetching text from ${url}`);
      const html = await GitbookLoader._scrape(url, this.caller, this.timeout);
      documents.push(...this.loadPath(html, url));
    }
    console.log(`Fetched ${documents.length} documents.`);
    return documents;
  }
}
