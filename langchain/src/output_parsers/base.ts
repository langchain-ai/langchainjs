import {
  SerializedRegexParser,
  SerializedCommaSeparatedListOutputParser,
  RegexParser,
} from "./index.js";

export type SerializedOutputParser =
  | SerializedRegexParser
  | SerializedCommaSeparatedListOutputParser;

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
  abstract parse(text: string): string | string[] | Record<string, string>;

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
  static deserialize(data: SerializedOutputParser): BaseOutputParser {
    switch (data._type) {
      case "regex_parser":
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return RegexParser.deserialize(data);
      default:
        throw new Error(`Unknown parser type: ${data._type}`);
    }
  }
}
