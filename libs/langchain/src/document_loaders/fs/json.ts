import jsonpointer from "jsonpointer";
import { TextLoader } from "./text.js";

/**
 * Class that extends the `TextLoader` class. It represents a document
 * loader that loads documents from JSON files. It has a constructor that
 * takes a `filePathOrBlob` parameter representing the path to the JSON
 * file or a `Blob` object, and an optional `pointers` parameter that
 * specifies the JSON pointers to extract.
 */
export class JSONLoader extends TextLoader {
  public pointers: string[];

  constructor(filePathOrBlob: string | Blob, pointers: string | string[] = []) {
    super(filePathOrBlob);
    this.pointers = Array.isArray(pointers) ? pointers : [pointers];
  }

  /**
   * Method that takes a `raw` string as a parameter and returns a promise
   * that resolves to an array of strings. It parses the raw JSON string and
   * extracts the values based on the specified JSON pointers. If no JSON
   * pointers are specified, it extracts all the strings from the JSON
   * object.
   * @param raw The raw JSON string to parse.
   * @returns A promise that resolves to an array of strings.
   */
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
   * If JSON pointers are specified, return all strings below any of them
   * and exclude all other nodes expect if they match a JSON pointer (to allow to extract strings from different levels)
   *
   * If no JSON pointer is specified then return all string in the object
   */
  private extractArrayStringsFromObject(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // If we found a targeted entry, we extract all strings from it
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

  /**
   * Method that takes a `json` object and an array of `pointers` as
   * parameters and returns an array of targeted entries. It iterates over
   * the JSON pointers and uses the `jsonpointer.get()` function to get the
   * targeted entries from the JSON object.
   * @param json The JSON object to get targeted entries from.
   * @param pointers The JSON pointers to get targeted entries.
   * @returns An array of targeted entries.
   */
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

/**
 * Class that extends the `TextLoader` class. It represents a document
 * loader that loads documents from JSON Lines files. It has a constructor
 * that takes a `filePathOrBlob` parameter representing the path to the
 * JSON Lines file or a `Blob` object, and a `pointer` parameter that
 * specifies the JSON pointer to extract.
 */
export class JSONLinesLoader extends TextLoader {
  constructor(filePathOrBlob: string | Blob, public pointer: string) {
    super(filePathOrBlob);
  }

  /**
   * Method that takes a `raw` string as a parameter and returns a promise
   * that resolves to an array of strings. It parses the raw JSON Lines
   * string, splits it into lines, parses each line as JSON, and extracts
   * the values based on the specified JSON pointer.
   * @param raw The raw JSON Lines string to parse.
   * @returns A promise that resolves to an array of strings.
   */
  protected async parse(raw: string): Promise<string[]> {
    const lines = raw.split("\n");
    const jsons = lines
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const pointer = jsonpointer.compile(this.pointer);
    return jsons.map((json) => pointer.get(json));
  }
}
