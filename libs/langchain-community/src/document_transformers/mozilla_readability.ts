import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import type { Options } from "mozilla-readability";
import {
  MappingDocumentTransformer,
  Document,
} from "@langchain/core/documents";

/**
 * A transformer that uses the Mozilla Readability library to extract the
 * main content from a web page.
 * @example
 * ```typescript
 * const loader = new CheerioWebBaseLoader("https://example.com/article");
 * const docs = await loader.load();
 *
 * const splitter = new RecursiveCharacterTextSplitter({
 *  maxCharacterCount: 5000,
 * });
 * const transformer = new MozillaReadabilityTransformer();
 *
 * // The sequence processes the loaded documents through the splitter and then the transformer.
 * const sequence = splitter.pipe(transformer);
 *
 * // Invoke the sequence to transform the documents into a more readable format.
 * const newDocuments = await sequence.invoke(docs);
 *
 * console.log(newDocuments);
 * ```
 */
export class MozillaReadabilityTransformer extends MappingDocumentTransformer {
  static lc_name() {
    return "MozillaReadabilityTransformer";
  }

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
