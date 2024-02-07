import { Document, DocumentInterface } from "@langchain/core/documents";
import { CheerioWebBaseLoader, WebBaseLoaderParams } from "./cheerio.js";

/**
 * Interface representing the parameters for initializing a SitemapLoader.
 * @interface SitemapLoaderParams
 * @extends WebBaseLoaderParams
 */
interface SitemapLoaderParams extends WebBaseLoaderParams {
  /**
   * @property {string[] | undefined} filterUrls - A list of regexes. Only URLs that match one of the filter URLs will be loaded.
   * WARNING: The filter URLs are interpreted as regular expressions. Escape special characters if needed.
   */
  filterUrls?: string[];
}

type SiteMapElement = {
  loc: string;
  changefreq?: string;
  lastmod?: string;
  priority?: string;
}

const MAX_CONCURRENCY_DEFAULT = 50;

export class SitemapLoader extends CheerioWebBaseLoader implements SitemapLoaderParams {
  allow_url_patterns: string[] | undefined;

  constructor(public webPath: string, params: SitemapLoaderParams = {}) {
    const paramsWithDefaults = { maxConcurrency: MAX_CONCURRENCY_DEFAULT, ...params }
    const path = `${webPath}/sitemap.xml`;
    super(path, paramsWithDefaults);

    this.webPath = path;
    this.allow_url_patterns = paramsWithDefaults.filterUrls;
  }

  async parseSitemap() {
    const $ = await CheerioWebBaseLoader._scrape(
      this.webPath,
      this.caller,
      this.timeout,
      this.textDecoder,
      {
        xmlMode: true
      }
    );

    const elements: Array<SiteMapElement> = [];

    $("url").each((_, element) => {
      const loc = $(element).find('loc').text();
      if (!loc) {
        return;
      }
      const changefreq = $(element).find("changefreq").text();
      const lastmod = $(element).find('lastmod').text();
      const priority = $(element).find('priority').text();

      elements.push({ loc, changefreq, lastmod, priority });
    });

    $("sitemap").each((_, element) => {
      const loc = $(element).find('loc').text();
      if (!loc) {
        return;
      }
      const changefreq = $(element).find("changefreq").text();
      const lastmod = $(element).find('lastmod').text();
      const priority = $(element).find('priority').text();

      elements.push({ loc, changefreq, lastmod, priority });
    });

    return elements;
  }

  private async _loadSitemapUrls(
    elements: Array<SiteMapElement>,
  ): Promise<DocumentInterface[]> {
    const all = await CheerioWebBaseLoader.scrapeAll(
      elements.map((ele) => ele.loc),
      this.caller,
      this.timeout,
      this.textDecoder,
    );
    const documents: Array<DocumentInterface> = all.map(($, i) => {
      if (!elements[i]) {
        throw new Error("Scraped docs and elements not in sync");
      }
      const text = $(this.selector).text();
      const { loc: source, ...metadata } = elements[i];
      return new Document({
        pageContent: text,
        metadata: {
          ...metadata,
          source: source.trim()
        }
      });
    });
    return documents;
  }

  async load(): Promise<Document[]> {
    const elements = await this.parseSitemap();
    const documents = await this._loadSitemapUrls(elements);
    return documents;
  }
}