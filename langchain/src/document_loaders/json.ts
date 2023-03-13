import jsonpointer from "jsonpointer";

import { TextLoader } from "./text.js";

export class JSONLoader extends TextLoader {
  constructor(filePathOrBlob: string | Blob, public pointer: string = "") {
    super(filePathOrBlob);
  }

  protected async parse(raw: string): Promise<string[]> {
    const json = JSON.parse(raw.trim());
    const pointer = jsonpointer.compile(this.pointer);

    return this.extractArrayStringsFromObject(json, pointer);
  }

  private extractArrayStringsFromObject(
    json: any,
    pointer: jsonpointer
  ): string[] {
    if (!json) {
      return [];
    }

    if (typeof json === "string") {
      return [json];
    }

    if (Array.isArray(json)) {
      let extractedString: string[] = [];
      for (const element of json) {
        extractedString = extractedString.concat(
          this.extractArrayStringsFromObject(element, pointer)
        );
      }

      return extractedString;
    }

    if (typeof json === "object") {
      if (this.pointer) {
        const targetedEntry = pointer.get(json);
        return this.extractArrayStringsFromObject(targetedEntry, pointer);
      }
      const values = Object.values(json);
      return this.extractArrayStringsFromObject(values, pointer);
    }

    return [];
  }
}
