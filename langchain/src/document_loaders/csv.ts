import { csvParse } from "d3-dsv";

import { TextLoader } from "./text.js";

/*
  Loads a CSV file into a list of documents.
  Each document represents one row of the CSV file. Every row is converted into a
  key/value pair and outputted to a new line in the document's page_content.
  Output Example:
    column1: value1
    column2: value2
    column3: value3
*/

export class CSVLoader extends TextLoader {
  constructor(filePath: string, public column: string) {
    super(filePath);
  }

  protected async parse(raw: string): Promise<string[]> {
    const parsed = csvParse(raw.trim());
    if (!parsed.columns.includes(this.column)) {
      throw new Error(`Column ${this.column} not found in CSV file.`);
    }

    return parsed.map((row) =>
      Object.keys(row).reduce(
        (acc, key) =>
          // eslint-disable-next-line prefer-template, no-useless-concat
          acc + `${key.trim()}: ${row[key]?.trim()}` + "\n",
        "\n"
      )
    );
  }
}
