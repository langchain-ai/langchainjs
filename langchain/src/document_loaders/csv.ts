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
    // Note TextLoader will raise an exception if the value is null.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return parsed.map((row) => row[this.column]!);
  }
}
