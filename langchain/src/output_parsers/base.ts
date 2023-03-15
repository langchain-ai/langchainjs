import { SerializedOutputParser } from "./serde.js";

/**
 * Class to parse the output of an LLM call.
 */
export abstract class BaseOutputParser {
  /**
   * Parse the output of an LLM call.
   *
   * @param text - LLM output to parse.
   * @returns Parsed output.
   */
  abstract parse(text: string): unknown;

  /**
   * Return a string describing the format of the output.
   * @returns Format instructions.
   * @example
   * ```json
   * {
   *  "foo": "bar"
   * }
   * ```
   */
  abstract getFormatInstructions(): string;

  /**
   * Return the string type key uniquely identifying this class of parser
   */
  _type(): string {
    throw new Error("_type not implemented");
  }

  /**
   * Return a json-like object representing this output parser.
   */
  abstract serialize(): SerializedOutputParser;

  /**
   * Load an output parser from a json-like object describing the parser.
   */
  static async deserialize(
    data: SerializedOutputParser
  ): Promise<BaseOutputParser> {
    switch (data._type) {
      case "regex_parser": {
        const { RegexParser } = await import("./regex.js");
        return RegexParser.deserialize(data);
      }
      default:
        throw new Error(`Unknown parser type: ${data._type}`);
    }
  }
}
