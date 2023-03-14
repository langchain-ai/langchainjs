import { csvParse } from "d3-dsv";

import { TextLoader } from "./text.js";

export class CSVLoader extends TextLoader {
  constructor(filePath: string, public column: string) {
    super(filePath);
  }

  protected async parse(raw: string): Promise<string[]> {
    const parsed = csvParse(raw.trim());
    if (!parsed.columns.includes(this.column)) {
      throw new Error(`Column ${this.column} not found in CSV file.`);
    }

    // each key/value in the csv should be separated by a newline
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
