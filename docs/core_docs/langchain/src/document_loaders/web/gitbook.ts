import type { CheerioAPI } from "cheerio";
import { Document } from "../../document.js";
import { CheerioWebBaseLoader } from "./cheerio.js";

/**
 * Interface representing the parameters for configuring the
 * GitbookLoader. It has an optional property shouldLoadAllPaths, which
 * indicates whether all paths should be loaded.
 */
interface GitbookLoaderParams {
  shouldLoadAllPaths?: boolean;
}

/**
 * Class representing a document loader specifically designed for loading
 * documents from Gitbook. It extends the CheerioWebBaseLoader.
 */
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

  /**
   * Method that scrapes the web document using Cheerio and loads the
   * content based on the value of shouldLoadAllPaths. If shouldLoadAllPaths
   * is true, it calls the loadAllPaths() method to load all paths.
   * Otherwise, it calls the loadPath() method to load a single path.
   * @returns Promise resolving to an array of Document instances.
   */
  public async load(): Promise<Document[]> {
    const $ = await this.scrape();

    if (this.shouldLoadAllPaths === true) {
      return this.loadAllPaths($);
    }
    return this.loadPath($);
  }

  /**
   * Private method that loads the content of a single path from the Gitbook
   * web document. It extracts the page content by selecting all elements
   * inside the "main" element, filters out empty text nodes, and joins the
   * remaining text nodes with line breaks. It extracts the title by
   * selecting the first "h1" element inside the "main" element. It creates
   * a Document instance with the extracted page content and metadata
   * containing the source URL and title.
   * @param $ CheerioAPI instance representing the loaded web document.
   * @param url Optional string representing the URL of the web document.
   * @returns Array of Document instances.
   */
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

  /**
   * Private method that loads the content of all paths from the Gitbook web
   * document. It extracts the URLs of all paths from the "loc" elements in
   * the sitemap.xml. It iterates over each URL, scrapes the web document
   * using the _scrape() method, and calls the loadPath() method to load the
   * content of each path. It collects all the loaded documents and returns
   * them as an array.
   * @param $ CheerioAPI instance representing the loaded web document.
   * @returns Promise resolving to an array of Document instances.
   */
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
