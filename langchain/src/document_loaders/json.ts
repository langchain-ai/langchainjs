import jsonpointer from "jsonpointer";

import { TextLoader } from "./text.js";

export class JSONLoader extends TextLoader {
  constructor(filePath: string, public pointer: string = "") {
    super(filePath);
  }

  protected async parse(raw: string): Promise<string[]> {
    const json = JSON.parse(raw.trim());
    const pointer = jsonpointer.compile(this.pointer);
    const value = pointer.get(json);
    return Array.isArray(value) ? value : [value];
  }
}
