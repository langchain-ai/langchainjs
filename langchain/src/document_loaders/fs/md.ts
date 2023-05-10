import type { marked } from "marked";
import { Document } from "../../document.js";
import { TextLoader } from "./text.js";

/**
 * Loads a markdown file into a list of Documents
 * Each document represents a section of markdown separated by headers.
 *
 * @example
 * // Markdown file:
 * // # This is the title
 * // Some description
 * //
 * // ## Section Title
 * //
 * // More content, etc.
 * //
 * // ### Subsection Title
 * //
 * // More content below it...
 *
 * const loader = new MarkdownLoader("path/to/file.md");
 * const docs = await loader.load();
 *
 * // docs[0].pageContent:
 * // # This is the title
 * // Some description
 *
 * // docs[1].pageContent:
 * // ## Section Title
 * //
 * // More content, etc.
 * //
 * // ### Subsection Title
 * //
 * // More content below it...
 *
 * If you want the cut-off to be at a different header depth, you can specify
 * it in the constructor:
 *
 * const loader = new MarkdownLoader("path/to/file.md", 3);
 *
 * This will split the document into sections at the `h3` header level instead
 * of the default at the `h2` header level.
 */
export class MarkdownLoader extends TextLoader {
  /**
   * @param filePathOrBlob The file path or blob to load
   * @param headerDepth The maximum depth of the header that we want to use to
   *                    split the document into sections
   */
  constructor(filePathOrBlob: string | Blob, private headerDepth: number = 2) {
    super(filePathOrBlob);
  }

  protected async parse(raw: string): Promise<(string | Document)[]> {
    const { marked } = await MarkdownLoader.markdownLoaderImports();
    const tokens = marked.lexer(raw.trim());

    const sections: Document[] = [];
    let currentSection = [] as marked.Token[];
    for (const token of tokens) {
      if (
        // If we encounter a header that is shallower than the header depth
        (token.type === "heading" && token.depth <= this.headerDepth) ||
        // Or if we encounter a horizontal rule
        token.type === "hr"
      ) {
        const pageContent = currentSection.reduce(
          (acc, val) => acc + val.raw,
          ""
        );
        sections.push(
          new Document({ pageContent, metadata: { section: sections.length } })
        );
        // Reset the current section
        currentSection = [token];
        continue;
      }
      currentSection.push(token);
    }

    return sections;
  }

  static async markdownLoaderImports() {
    try {
      const { marked } = await import("marked");
      return { marked };
    } catch (error) {
      console.error(error);
      throw new Error(
        "Please install marked as a dependency with, e.g. `yarn add marked`"
      );
    }
  }
}
