import wiki, { Page } from "wikipedia";
import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";

const DISCARDCATEGORIES = [
  "See also",
  "References",
  "External links",
  "Further reading",
  "Footnotes",
  "Bibliography",
  "Sources",
  "Citations",
  "Literature",
  "Footnotes",
  "Notes and references",
  "Photo gallery",
  "Works cited",
  "Photos",
  "Gallery",
  "Notes",
  "References and sources",
  "References and notes",
];

export class WikipediaLoader extends BaseDocumentLoader {
  discardCategories: string[];

  constructor(public webPath: string, discardCategories?: string[]) {
    super();
    this.discardCategories = discardCategories ?? DISCARDCATEGORIES;
  }

  public async load(): Promise<Document[]> {
    const matchResult = this.webPath.match(/\/wiki\/(.+)/);
    if (!matchResult) {
      throw new Error(
        "Invalid webPath format. Use full url like https://en.wikipedia.org/wiki/2020_Summer_Olympics"
      );
    }

    const pageTitle = decodeURIComponent(matchResult[1]);
    const page: Page = await wiki.page(pageTitle);
    const content = await page.content();
    const sections = this.extractSections(
      content,
      page.title,
      this.discardCategories
    );

    const docs = sections.map(
      (section) =>
        new Document({
          pageContent: section,
          metadata: { source: this.webPath },
        })
    );
    return docs;
  }

  // converted from the openai cookbook example
  // https://github.com/openai/openai-cookbook/blob/main/examples/fine-tuned_qa/olympics-1-collect-data.ipynb
  private extractSections(
    wikiText: string,
    title: string,
    discardCategories: string[]
  ): string[] {
    if (wikiText.length === 0) {
      return [];
    }

    const discard = new Set(discardCategories);

    let wikiTextReplaced = wikiText;

    const regex = /==+ .* ==+/g;
    const headings = wikiTextReplaced.match(regex) || [];

    for (const heading of headings) {
      wikiTextReplaced = wikiTextReplaced.replace(heading, "==+ !! ==+");
    }
    const contents = wikiTextReplaced.split("==+ !! ==+");
    const contentsTrimmed = contents.map((content) => content.trim());
    if (headings) {
      headings.pop();
    }

    const cont = contentsTrimmed.shift();
    const outputs = [`${title}: "Summary:" ${cont}`];

    const maxLevel = 100;
    let keepGroupLevel = maxLevel;
    let removeGroupLevel = maxLevel;
    const nheadings = [];
    const ncontents = [];
    for (let i = 0; i < headings.length; i += 1) {
      const heading = headings[i];
      const content = contentsTrimmed[i];
      const plainHeading = heading.split(" ").slice(1, -1).join(" ");
      const numEquals = heading.split(" ")[0].length;
      if (numEquals <= keepGroupLevel) {
        keepGroupLevel = maxLevel;
      }

      if (numEquals > removeGroupLevel) {
        if (numEquals <= keepGroupLevel) {
          // eslint-disable-next-line no-continue
          continue;
        }
      }
      keepGroupLevel = maxLevel;
      if (discard.has(plainHeading)) {
        removeGroupLevel = numEquals;
        keepGroupLevel = maxLevel;
        // eslint-disable-next-line no-continue
        continue;
      }
      nheadings.push(heading.replace(/=/g, "").trim());
      ncontents.push(content);
      removeGroupLevel = maxLevel;
    }

    for (let i = 0; i < nheadings.length; i += 1) {
      const h = nheadings[i];
      const c = ncontents[i];
      outputs.push(`${title}: ${h}: ${c}`);
    }

    return outputs;
  }
}
