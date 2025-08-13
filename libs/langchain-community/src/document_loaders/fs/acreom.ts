import type { basename as BasenameT } from "node:path";
import type { readFile as ReadFileT, stat as StatT } from "node:fs/promises";
import yaml from "js-yaml";
import { Document } from "@langchain/core/documents";
import { getEnv } from "@langchain/core/utils/env";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import {
  DirectoryLoader,
  UnknownHandling,
} from "langchain/document_loaders/fs/directory";

export type FrontMatter = {
  title?: string;
  description?: string;
  tags?: string[] | string;
  [key: string]: unknown;
};

export interface AcreomFileLoaderOptions {
  encoding?: BufferEncoding;
  collectMetadata?: boolean;
}

/**
 * Represents a loader for Acreom markdown files. This loader extends the BaseDocumentLoader
 * and provides functionality to parse metadata, tags, and content-specific rules for Acreom files.
 */
export class AcreomFileLoader extends BaseDocumentLoader {
  private filePath: string;

  private encoding: BufferEncoding;

  private collectMetadata: boolean;

  private static FRONT_MATTER_REGEX = /^---\n(.*?)\n---\n/s;

  private static ACREOM_HASHTAGS_REGEX = /#/g;

  private static ACREOM_TASKS_REGEX = /\s*-\s\[\s\]\s.*|\s*\[\s\]\s.*/g;

  private static ACREOM_LINKS_REGEX = /\[\[.*?\]\]/g;

  /**
   * Initializes a new instance of the AcreomFileLoader class.
   * @param filePath The path to the Acreom markdown file.
   * @param options Configuration options for encoding and metadata collection.
   */
  constructor(
    filePath: string,
    { encoding = "utf-8", collectMetadata = true }: AcreomFileLoaderOptions = {}
  ) {
    super();
    this.filePath = filePath;
    this.encoding = encoding;
    this.collectMetadata = collectMetadata;
  }

  /**
   * Parses YAML front matter from the given content string.
   * @param content The string content of the markdown file.
   * @returns An object representing the parsed front matter.
   */
  private parseFrontMatter(content: string): FrontMatter {
    if (!this.collectMetadata) {
      return {};
    }

    const match = content.match(AcreomFileLoader.FRONT_MATTER_REGEX);
    if (!match) {
      return {};
    }

    try {
      return yaml.load(match[1]) as FrontMatter;
    } catch (e) {
      console.warn("Encountered non-yaml frontmatter");
      return {};
    }
  }

  /**
   * Removes YAML front matter from the given content string.
   * @param content The string content of the markdown file.
   * @returns The content string with front matter removed.
   */
  private removeFrontMatter(content: string): string {
    return this.collectMetadata
      ? content.replace(AcreomFileLoader.FRONT_MATTER_REGEX, "")
      : content;
  }

  /**
   * Processes Acreom-specific content rules, such as removing tasks, hashtags, and doclinks.
   * @param content The raw content of the markdown file.
   * @returns Cleaned content.
   */
  private processAcreomContent(content: string): string {
    return content
      .replace(AcreomFileLoader.ACREOM_TASKS_REGEX, "") // Remove tasks
      .replace(AcreomFileLoader.ACREOM_HASHTAGS_REGEX, "") // Remove hashtags
      .replace(AcreomFileLoader.ACREOM_LINKS_REGEX, ""); // Remove double-bracketed links
  }

  /**
   * Converts metadata to a format compatible with LangChain.
   * @param metadata The metadata object to convert.
   * @returns A record object containing key-value pairs of LangChain-compatible metadata.
   */
  private toLangchainCompatibleMetadata(metadata: Record<string, unknown>) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === "string" || typeof value === "number") {
        result[key] = value;
      } else {
        result[key] = JSON.stringify(value);
      }
    }
    return result;
  }

  /**
   * Loads the Acreom file, parses it, and returns a `Document` instance.
   * @returns An array of `Document` instances to comply with the BaseDocumentLoader interface.
   */
  public async load(): Promise<Document[]> {
    const { basename, readFile, stat } = await AcreomFileLoader.imports();
    const fileName = basename(this.filePath);
    const stats = await stat(this.filePath);
    let content = await readFile(this.filePath, this.encoding);

    const frontMatter = this.parseFrontMatter(content);
    content = this.removeFrontMatter(content);
    content = this.processAcreomContent(content);

    const metadata: Document["metadata"] = {
      source: fileName,
      path: this.filePath,
      created: stats.birthtimeMs,
      lastModified: stats.mtimeMs,
      lastAccessed: stats.atimeMs,
      ...this.toLangchainCompatibleMetadata(frontMatter),
    };

    return [
      new Document({
        pageContent: content,
        metadata,
      }),
    ];
  }

  /**
   * Dynamically imports required modules. Throws an error if the imports fail.
   * @returns An object containing the imported modules.
   */
  static async imports(): Promise<{
    basename: typeof BasenameT;
    readFile: typeof ReadFileT;
    stat: typeof StatT;
  }> {
    try {
      const { basename } = await import("node:path");
      const { readFile, stat } = await import("node:fs/promises");
      return { basename, readFile, stat };
    } catch (e) {
      console.error(e);
      throw new Error(
        `Failed to load fs/promises. AcreomFileLoader available only in 'node' environment. Current environment: '${getEnv()}'.`
      );
    }
  }
}

/**
 * Represents a loader for directories containing Acreom markdown files. This loader extends
 * the DirectoryLoader and provides functionality to load and parse `.md` files with YAML frontmatter
 * and Acreom-specific rules for tasks, hashtags, and links.
 */
export class AcreomLoader extends DirectoryLoader {
  /**
   * Initializes a new instance of the AcreomLoader class.
   * @param directoryPath The path to the directory containing Acreom markdown files.
   * @param options Configuration options for encoding and metadata collection.
   */
  constructor(directoryPath: string, options?: AcreomFileLoaderOptions) {
    super(
      directoryPath,
      {
        ".md": (filePath) => new AcreomFileLoader(filePath, options),
      },
      true, // Recursive directory loading
      UnknownHandling.Ignore // Ignore unknown file types
    );
  }
}
