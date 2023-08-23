import { JSDOM } from "jsdom";
import { Document } from "../../document.js";
import { AsyncCaller } from "../../util/async_caller.js";

interface Options {
  excludeDirs?: string[];
  extractor?(text: string): string;
  maxDepth?: number;
  timeout?: number;
  preventOutside?: boolean;
  callerOptions?: ConstructorParameters<typeof AsyncCaller>[0];
}

class RecursiveUrlLoader {
  private caller: AsyncCaller;

  private url: string;
  private excludeDirs: string[];
  private extractor: (text: string) => string;
  private maxDepth: number;
  private timeout: number;
  private preventOutside: boolean;

  constructor(url: string, options: Options) {
    this.caller = new AsyncCaller({
      maxConcurrency: 64,
      ...options.callerOptions,
    });

    this.url = url;
    this.excludeDirs = options.excludeDirs ?? [];
    this.extractor = options.extractor ?? ((s: string) => s);
    this.maxDepth = options.maxDepth ?? 2;
    this.timeout = options.timeout ?? 10000;
    this.preventOutside = options.preventOutside ?? true;
  }

  private fetchWithTimeout(
    resource: string,
    options: { timeout?: number } & RequestInit
  ): Promise<Response> {
    const { timeout } = options;

    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("timeout"));
      }, timeout);

      this.caller.call(() =>
        fetch(resource, options)
          .then(resolve)
          .catch(reject)
          .finally(() => clearTimeout(timer))
      );
    });
  }

  private getChildLinks(html: string, baseUrl: string): Array<string> {
    let allLinks = Array.from(
      new JSDOM(html).window.document.querySelectorAll("a")
    ).map((a) => a.href);
    let absolutePaths = [];
    let invalid_prefixes = ["javascript:", "mailto:", "#"];
    let invalid_suffixes = [
      ".css",
      ".js",
      ".ico",
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
    ];

    for (let link of allLinks) {
      if (
        invalid_prefixes.some((prefix) => link.startsWith(prefix)) ||
        invalid_suffixes.some((suffix) => link.endsWith(suffix))
      )
        continue;

      if (link.startsWith("http")) {
        const isAllowed = !this.preventOutside || link.startsWith(baseUrl);
        if (isAllowed) absolutePaths.push(link);
      } else if (link.startsWith("//")) {
        const base = new URL(baseUrl);
        absolutePaths.push(base.protocol + link);
      } else {
        const newLink = new URL(link, baseUrl).href;
        absolutePaths.push(newLink);
      }
    }

    return Array.from(new Set(absolutePaths));
  }

  private extractMetadata(rawHtml: string, url: string): Record<string, any> {
    const metadata: Record<string, any> = { source: url };
    const dom = new JSDOM(rawHtml);
    const document = dom.window.document;

    const title = document.getElementsByTagName("title")[0];
    if (title) {
      metadata.title = title.textContent;
    }

    const description = document.querySelector("meta[name=description]");
    if (description) {
      metadata.description = description.getAttribute("content");
    }

    const html = document.getElementsByTagName("html")[0];
    if (html) {
      metadata.language = html.getAttribute("lang");
    }

    return metadata;
  }

  private async getUrlAsDoc(url: string): Promise<Document | null> {
    let res;
    try {
      res = await this.fetchWithTimeout(url, { timeout: this.timeout });
      res = await res.text();
    } catch (e) {
      return null;
    }

    return {
      pageContent: this.extractor(res),
      metadata: this.extractMetadata(res, url),
    };
  }

  private async getChildUrlsRecursive(
    url: string,
    visited: Set<string> = new Set<string>(),
    depth: number = 0
  ): Promise<Document[]> {
    if (depth > this.maxDepth) return [];

    if (!url.endsWith("/")) url += "/";

    const isExcluded = this.excludeDirs.some((exDir) => url.startsWith(exDir));
    if (isExcluded) return [];

    let res;
    try {
      res = await this.fetchWithTimeout(url, { timeout: this.timeout });
      res = await res.text();
    } catch (e) {
      return [];
    }

    const childUrls: string[] = this.getChildLinks(res, url);

    return (
      await Promise.all(
        childUrls.map((childUrl) =>
          (async () => {
            if (visited.has(childUrl)) return null;
            visited.add(childUrl);

            const childDoc = await this.getUrlAsDoc(childUrl);
            if (!childDoc) return null;

            if (childUrl.endsWith("/")) {
              return [
                childDoc,
                ...(await this.getChildUrlsRecursive(
                  childUrl,
                  visited,
                  depth + 1
                )),
              ];
            }

            return [childDoc];
          })()
        )
      )
    )
      .flat()
      .filter((docs) => docs !== null) as Document[];
  }

  async load(): Promise<Document[]> {
    const rootDoc = await this.getUrlAsDoc(this.url);
    if (!rootDoc) return [];

    const docs = [rootDoc];
    docs.push(
      ...(await this.getChildUrlsRecursive(this.url, new Set([this.url])))
    );
    return docs;
  }
}

export default RecursiveUrlLoader;
