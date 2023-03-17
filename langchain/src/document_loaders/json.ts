import jsonpointer from "jsonpointer";

import { TextLoader } from "./text.js";

export class JSONLoader extends TextLoader {
  constructor(filePathOrBlob: string | Blob, public pointer: string = "") {
    super(filePathOrBlob);
  }

  protected async parse(raw: string): Promise<string[]> {
    const json = JSON.parse(raw.trim());
    const pointer = jsonpointer.compile(this.pointer);
    const value = pointer.get(json);
    return Array.isArray(value) ? value : [value];
  }
}
