import { TextLoader } from "./text.js";

export class JSONLoader extends TextLoader {
  constructor(filePath: string, public keys: string[] = []) {
    super(filePath);
  }

  protected async parse(raw: string): Promise<string[]> {
    const json = JSON.parse(raw.trim());
    const extractAllStrings = !(this.keys.length > 0);

    return this.extractArrayStringsFromObject(json, extractAllStrings);
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
          this.extractArrayStringsFromObject(element, true)
        );
      }

      return extractedString;
    }

    if (typeof json === "object") {
      if (!extractAllStrings) {
        // If there is a leaf we return otherwise we continue
        const currentKeys = Object.keys(json);
        const foundKeys = currentKeys.filter((oneKey) =>
          this.keys.includes(oneKey)
        );
        const notFoundKeys = currentKeys.filter(
          (oneKey) => !this.keys.includes(oneKey)
        );

        let extractedStrings: string[] = [];
        // If we
        if (foundKeys.length > 0) {
          for (const oneFoundKey of foundKeys) {
            extractedStrings = extractedStrings.concat(
              this.extractArrayStringsFromObject(json[oneFoundKey], true, true)
            );
          }

          for (const oneNotFoundKey of notFoundKeys) {
            extractedStrings = extractedStrings.concat(
              this.extractArrayStringsFromObject(
                json[oneNotFoundKey],
                false,
                true
              )
            );
          }
        } else if (extractAllStrings || !keyHasBeenFound) {
          for (const oneNotFoundKey of notFoundKeys) {
            extractedStrings = extractedStrings.concat(
              this.extractArrayStringsFromObject(
                json[oneNotFoundKey],
                extractAllStrings
              )
            );
          }
        }

        return extractedStrings;
      }

      // If there is no key specified we extract all strings
      return this.extractArrayStringsFromObject(
        Object.values(json),
        extractAllStrings
      );
    }

    return [];
  }
}
