import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { Options } from "mozilla-readability";
import { Document } from "../document.js";
import { MappingDocumentTransformer } from "../schema/document.js";

export class MozillaReadabilityTransformer extends MappingDocumentTransformer {
  constructor(protected options: Options = {}) {
    super(options);
  }

  async _transformDocument(document: Document): Promise<Document> {
    const doc = new JSDOM(document.pageContent);

    const readability = new Readability(doc.window.document, this.options);

    const result = readability.parse();

    return new Document({
      pageContent: result?.textContent ?? "",
      metadata: {
        ...document.metadata,
      },
    });
  }
}
