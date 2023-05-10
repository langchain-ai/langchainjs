import type { marked } from "marked";
import { Document } from "../../document.js";
import { TextLoader } from "./text.js";

type MarkdownLoaderConfig =
  | {
      /** Whether or not to split the section */
      splitSection: false;
    }
  | {
      /** Whether or not to split the section */
      splitSection?: true;
      /**
       * If we are splitting sections, we can set the header depth that we want
       * to split the sections on.
       */
      headerDepth?: number;
      /**
       * Whether or not to split the section on horizontal rules
       */
      splitOnHorizontalRule?: boolean;
    };

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
 * const loader = new MarkdownLoader("path/to/file.md", { headerDepth: 3 });
 *
 * This will split the document into sections at the `h3` header level instead
 * of the default at the `h2` header level.
 */
export class MarkdownLoader extends TextLoader {
  private splitSection: boolean;
  private headerDepth: number;
  private splitOnHorizontalRule: boolean;
  /**
   * @param filePathOrBlob The file path or blob to load
   * @param config The configuration for the loader
   */
  constructor(filePathOrBlob: string | Blob, config?: MarkdownLoaderConfig) {
    super(filePathOrBlob);
    // Configure the loader options
    this.splitSection = config?.splitSection ?? true;
    if (config?.splitSection !== false) {
      this.headerDepth = config?.headerDepth ? config.headerDepth : 2;
      this.splitOnHorizontalRule = config?.splitOnHorizontalRule ?? true;
    }
  }

  protected async parse(raw: string): Promise<(string | Document)[]> {
    // If we don't want to split the section then just return the whole file as
    // a single document
    if (!this.splitSection) {
      return [
        new Document({ pageContent: raw.trim(), metadata: { section: 1 } }),
      ];
    }

    const { marked } = await MarkdownLoader.markdownLoaderImports();

    const tokens = marked.lexer(raw.trim());

    const sections: Document[] = [];
    let currentSection = [] as marked.Token[];
    for (const token of tokens) {
      if (
        currentSection.length &&
        // If we encounter a header that is shallower than the header depth
        ((token.type === "heading" && token.depth <= this.headerDepth) ||
          // Or if we encounter a horizontal rule
          (this.splitOnHorizontalRule && token.type === "hr"))
      ) {
        sections.push(
          createDocumentFromTokens(currentSection, {
            section: sections.length + 1,
          })
        );
        // Reset the current section
        currentSection = [token];
        continue;
      }
      currentSection.push(token);
    }

    // Add in the last section if it exists
    if (currentSection.length) {
      sections.push(
        createDocumentFromTokens(currentSection, {
          section: sections.length + 1,
        })
      );
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

/**
 * Create a document from a list of marked tokens.
 * @param tokens The list of tokens to create the document from
 * @param metadata Any metadata to add to the document
 * @returns
 */
function createDocumentFromTokens<TMetadata extends Record<string, any>>(
  tokens: marked.Token[],
  metadata: TMetadata
): Document {
  const pageContent = tokens.reduce((acc, val) => acc + val.raw, "").trim();
  return new Document({ pageContent, metadata });
}
