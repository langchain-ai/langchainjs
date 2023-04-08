import { TextLoader } from "./text.js";
import { BaseDocumentLoader } from "./base.js";
import { Document } from "../document.js";

/**
 * Loads a CSV file into a list of documents.
 * Each document represents one row of the CSV file.
 *
 * When `column` is not specified, each row is converted into a key/value pair
 * with each key/value pair outputted to a new line in the document's pageContent.
 *
 * @example
 * // CSV file:
 * // id,html
 * // 1,<i>Corruption discovered at the core of the Banking Clan!</i>
 * // 2,<i>Corruption discovered at the core of the Banking Clan!</i>
 *
 * const loader = new CSVLoader("path/to/file.csv");
 * const docs = await loader.load();
 *
 * // docs[0].pageContent:
 * // id: 1
 * // html: <i>Corruption discovered at the core of the Banking Clan!</i>
 *
 * When `column` is specified, one document is created for each row, and the
 * value of the specified column is used as the document's pageContent.
 *
 * @example
 * // CSV file:
 * // id,html
 * // 1,<i>Corruption discovered at the core of the Banking Clan!</i>
 * // 2,<i>Corruption discovered at the core of the Banking Clan!</i>
 *
 * const loader = new CSVLoader("path/to/file.csv", "html");
 * const docs = await loader.load();
 *
 * // docs[0].pageContent:
 * // <i>Corruption discovered at the core of the Banking Clan!</i>
 */
export class CSVLoader extends BaseDocumentLoader {
  constructor(
    public filePathOrBlob: string | Blob,
    public column?: string,
    public metadataColumns?: string[]
  ) {
    super();
  }

  async load(): Promise<Document[]> {
    const raw = await this.loadRawData();
    const { csvParse } = await CSVLoaderImports();
    const parsed = csvParse(raw.trim());
    const { column, metadataColumns } = this;

    if (column !== undefined && !parsed.columns.includes(column)) {
      throw new Error(`Column ${column} not found in CSV file.`);
    }

    if (metadataColumns) {
      for (const metadataColumn of metadataColumns) {
        if (!parsed.columns.includes(metadataColumn)) {
          throw new Error(
            `Metadata column ${metadataColumn} not found in CSV file.`
          );
        }
      }
    }

    const contents = parsed.map((row, i) => {
      const content = column
        ? row[column]
        : Object.keys(row)
            .map((key) => `${key.trim()}: ${row[key]?.trim()}`)
            .join("\n");

      if (typeof content !== "string") {
        throw new Error(
          `Expected string, at position ${i} got ${typeof content}`
        );
      }

      return content;
    });

    return contents.map((content, i) => {
      interface Metadata {
        [key: string]: string | number;
      }

      const metadata: Metadata = {};

      if (metadataColumns) {
        for (const metadataColumn of metadataColumns) {
          metadata[metadataColumn] = parsed[i][metadataColumn] as
            | string
            | number;
        }
      }

      const isSourceInMetadata = metadataColumns?.includes("source");
      const isFilePathString = typeof this.filePathOrBlob === "string";
      let source: string | number;

      if (isSourceInMetadata) {
        source = metadata.source;
      } else if (isFilePathString) {
        source = this.filePathOrBlob as string;
      } else {
        source = "blob";
      }

      const isLineInMetadata = metadataColumns?.includes("line");
      const line = isLineInMetadata ? metadata.line : i + 1;

      return new Document({
        pageContent: content,
        metadata: {
          ...metadata,
          source,
          line,
        },
      });
    });
  }

  async loadRawData(): Promise<string> {
    if (typeof this.filePathOrBlob === "string") {
      const { readFile } = await TextLoader.imports();
      return readFile(this.filePathOrBlob, "utf8");
    }

    return this.filePathOrBlob.text();
  }
}

async function CSVLoaderImports() {
  try {
    const { csvParse } = await import("d3-dsv");
    return { csvParse };
  } catch (e) {
    console.error(e);
    throw new Error(
      "Please install d3-dsv as a dependency with, e.g. `yarn add d3-dsv`"
    );
  }
}
