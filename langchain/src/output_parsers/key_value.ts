import { RecordOutputParser } from "./base.js";
import { SerializedKeyValueOutputParser } from "./serde.js";

/**
 * Class to parse the output of an LLM call as a list of key: value pairs.
 * @augments RecordOutputParser
 */
export class KeyValueOutputParser extends RecordOutputParser {
  constructor(public keys: string[] = []) {
    super();
  }

  parse(text: string): Record<string, string> {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line, i) => {
        if (i === 0 && !line.includes(":")) {
          // Assume the key was included in the prompt
          return { key: this.keys[0], value: line.trim() };
        }
        const [key, value] = line.split(":");
        return { key: key.trim(), value: value.trim() };
      })
      .reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
  }

  getFormatInstructions(): string {
    return `Your response should be a list of key-value pairs, one per line, in the format "key: value", including the following keys:
${this.keys.map((key) => `${key}: <value>`).join("\n")}`;
  }

  serialize(): SerializedKeyValueOutputParser {
    return {
      _type: "key_value",
      keys: this.keys,
    };
  }

  static async deserialize(
    value: SerializedKeyValueOutputParser
  ): Promise<KeyValueOutputParser> {
    return new KeyValueOutputParser(value.keys);
  }
}
