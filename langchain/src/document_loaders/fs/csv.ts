import { TextLoader } from "./text.js";

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

type CSVLoaderOptions = {
  column?: string;
  separator?: string;
};

export class CSVLoader extends TextLoader {
  protected options: CSVLoaderOptions = {};

  constructor(
    filePathOrBlob: string | Blob,
    options?: CSVLoaderOptions | string
  ) {
    super(filePathOrBlob);
    if (typeof options === "string") {
      this.options = { column: options };
    } else {
      this.options = options ?? this.options;
    }
  }

  protected async parse(raw: string): Promise<string[]> {
    const { column, separator = "," } = this.options;

    const { dsvFormat } = await CSVLoaderImports();
    const psv = dsvFormat(separator);
    const parsed = psv.parse(raw.trim());

    if (column !== undefined) {
      if (!parsed.columns.includes(column)) {
        throw new Error(`Column ${column} not found in CSV file.`);
      }
      // Note TextLoader will raise an exception if the value is null.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return parsed.map((row) => row[column]!);
    }

    return parsed.map((row) =>
      Object.keys(row)
        .map((key) => `${key.trim()}: ${row[key]?.trim()}`)
        .join("\n")
    );
  }
}

async function CSVLoaderImports() {
  try {
    const { dsvFormat } = await import("d3-dsv");
    return { dsvFormat };
  } catch (e) {
    console.error(e);
    throw new Error(
      "Please install d3-dsv as a dependency with, e.g. `yarn add d3-dsv@2`"
    );
  }
}
