import { htmlToText } from "html-to-text";
import type { HtmlToTextOptions } from "html-to-text";
import { Document } from "../document.js";
import { MappingDocumentTransformer } from "../schema/document.js";

export class HtmlToTextTransformer extends MappingDocumentTransformer {
  constructor(protected options: HtmlToTextOptions = {}) {
    super(options);
  }

  async _transformDocument(document: Document): Promise<Document> {
    const extractedContent = htmlToText(document.pageContent, this.options);
    return new Document({
      pageContent: extractedContent,
      metadata: { ...document.metadata },
    });
  }
}
