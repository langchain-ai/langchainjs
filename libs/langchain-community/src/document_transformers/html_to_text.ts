import { htmlToText, type HtmlToTextOptions } from "html-to-text";
import {
  MappingDocumentTransformer,
  Document,
} from "@langchain/core/documents";

/**
 * A transformer that converts HTML content to plain text.
 * @example
 * ```typescript
 * const loader = new CheerioWebBaseLoader("https://example.com/some-page");
 * const docs = await loader.load();
 *
 * const splitter = new RecursiveCharacterTextSplitter({
 *  maxCharacterCount: 1000,
 * });
 * const transformer = new HtmlToTextTransformer();
 *
 * // The sequence of text splitting followed by HTML to text transformation
 * const sequence = splitter.pipe(transformer);
 *
 * // Processing the loaded documents through the sequence
 * const newDocuments = await sequence.invoke(docs);
 *
 * console.log(newDocuments);
 * ```
 */
export class HtmlToTextTransformer extends MappingDocumentTransformer {
  static lc_name() {
    return "HtmlToTextTransformer";
  }

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
