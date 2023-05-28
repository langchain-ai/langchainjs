import { TextLoader } from "./text.js";

/**
 * Loads a DSV file into a list of documents.
 * Each document represents one row of the DSV file.
 *
 * When `delimiter` is not specified, it acts like a CSVLoader and use the Comma as delimiter
 * 
 * When `column` is not specified, each row is converted into a key/value pair
 * with each key/value pair outputted to a new line in the document's pageContent.
 *
 * @example
 * // DSV file:
 * // id|html
 * // 1|<i>Corruption discovered at the core of the Banking Clan!</i>
 * // 2|<i>Corruption discovered at the core of the Banking Clan!</i>
 *
 * const loader = new DSVLoader("path/to/file.dsv" , {delimiter = '|'});
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
 * // DSV file:
 * // id|html
 * // 1|<i>Corruption discovered at the core of the Banking Clan!</i>
 * // 2|<i>Corruption discovered at the core of the Banking Clan!</i>
 *
 * const loader = new DSVLoader("path/to/file.dsv", {delimiter=',',column='html'});
 * const docs = await loader.load();
 *
 * // docs[0].pageContent:
 * // <i>Corruption discovered at the core of the Banking Clan!</i>
 */
export class DSVLoader extends TextLoader {
  private delimiter: string;
  private column?: string | undefined;

  constructor(filePathOrBlob, { delimiter = ',', column = undefined } = {}) {
    super(filePathOrBlob);
    this.delimiter = delimiter;
    this.column = column;
  }

  protected async parse(raw: string): Promise<string[]> {
    const { dsv } = await DSVLoaderImports();
    const parsed = dsv.parse(raw.trim());
    const { column } = this;

    if (column !== undefined) {
      if (!parsed.columns.includes(column)) {
        throw new Error(`Column ${column} not found in DSV file.`);
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

async function DSVLoaderImports() {
  try {
    const { dsvFormat } = await import("d3-dsv");
    const dsv = dsvFormat(delimiter);
    return { dsv };
  } catch (e) {
    console.error(e);
    throw new Error(
      "Please install d3-dsv as a dependency with, e.g. `yarn add d3-dsv@2`"
    );
  }
}
