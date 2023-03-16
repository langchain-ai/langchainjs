import jsonpointer from "jsonpointer";
import { TextLoader } from "./text.js";

export class JSONLoader extends TextLoader {
  constructor(filePath: string, public pointers: string[] = []) {
    super(filePath);
  }

  protected async parse(raw: string): Promise<string[]> {
    const json = JSON.parse(raw.trim());
    // If there is no pointers specified we extract all strings we found
    const extractAllStrings = !(this.pointers.length > 0);
    const compiledPointers = this.pointers.map((pointer) =>
      jsonpointer.compile(pointer)
    );

    return this.extractArrayStringsFromObject(
      json,
      compiledPointers,
      extractAllStrings
    );
  }

  /**
   * If keys are specified, return all strings below any node represented by a key
   * and exclude all other nodes expect if they contain a key
   *
   * If no key is specified then return all string in the object
   * @param json
   * @private
   */
  private extractArrayStringsFromObject(
    json: any,
    pointers: jsonpointer[],
    extractAllStrings = false,
    keyHasBeenFound = false
  ): string[] {
    if (!json) {
      return [];
    }

    if (typeof json === "string" && extractAllStrings) {
      return [json];
    }

    if (Array.isArray(json) && extractAllStrings) {
      let extractedString: string[] = [];
      for (const element of json) {
        extractedString = extractedString.concat(
          this.extractArrayStringsFromObject(element, pointers, true)
        );
      }

      return extractedString;
    }

    if (typeof json === "object") {
      if (extractAllStrings) {
        return this.extractArrayStringsFromObject(
          Object.values(json),
          pointers,
          true
        );
      }

      const targetedEntries = this.getTargetedEntries(json, pointers);
      const thisLevelEntries = Object.values(json) as object[];
      const notTargetedEntries = thisLevelEntries.filter(
        (entry: object) => !targetedEntries.includes(entry)
      );

      let extractedStrings: string[] = [];
      // If we
      if (targetedEntries.length > 0) {
        for (const oneEntry of targetedEntries) {
          extractedStrings = extractedStrings.concat(
            this.extractArrayStringsFromObject(oneEntry, pointers, true, true)
          );
        }

        for (const oneEntry of notTargetedEntries) {
          extractedStrings = extractedStrings.concat(
            this.extractArrayStringsFromObject(oneEntry, pointers, false, true)
          );
        }
      } else if (extractAllStrings || !keyHasBeenFound) {
        for (const oneEntry of notTargetedEntries) {
          extractedStrings = extractedStrings.concat(
            this.extractArrayStringsFromObject(
              oneEntry,
              pointers,
              extractAllStrings
            )
          );
        }
      }

      return extractedStrings;
    }

    return [];
  }

  private getTargetedEntries(json: object, pointers: jsonpointer[]): object[] {
    const targetEntries = [];
    for (const pointer of pointers) {
      const targetedEntry = pointer.get(json);
      if (targetedEntry) {
        targetEntries.push(targetedEntry);
      }
    }

    return targetEntries;
  }
}
