import { BaseOutputParser, OutputParserException } from "./base.js";

/**
 * Class to parse the output of an LLM call to a list.
 * @augments BaseOutputParser
 */
export abstract class ListOutputParser extends BaseOutputParser<string[]> {}

/**
 * Class to parse the output of an LLM call as a comma-separated list.
 * @augments ListOutputParser
 */
export class CommaSeparatedListOutputParser extends ListOutputParser {
  static lc_name() {
    return "CommaSeparatedListOutputParser";
  }

  lc_namespace = ["langchain_core", "output_parsers", "list"];

  lc_serializable = true;

  /**
   * Parses the given text into an array of strings, using a comma as the
   * separator. If the parsing fails, throws an OutputParserException.
   * @param text The text to parse.
   * @returns An array of strings obtained by splitting the input text at each comma.
   */
  async parse(text: string): Promise<string[]> {
    try {
      return text
        .trim()
        .split(",")
        .map((s) => s.trim());
    } catch (e) {
      throw new OutputParserException(`Could not parse output: ${text}`, text);
    }
  }

  /**
   * Provides instructions on the expected format of the response for the
   * CommaSeparatedListOutputParser.
   * @returns A string containing instructions on the expected format of the response.
   */
  getFormatInstructions(): string {
    return `Your response should be a list of comma separated values, eg: \`foo, bar, baz\``;
  }
}

/**
 * Class to parse the output of an LLM call to a list with a specific length and separator.
 * @augments ListOutputParser
 */
export class CustomListOutputParser extends ListOutputParser {
  lc_namespace = ["langchain_core", "output_parsers", "list"];

  private length: number | undefined;

  private separator: string;

  constructor({ length, separator }: { length?: number; separator?: string }) {
    super(...arguments);
    this.length = length;
    this.separator = separator || ",";
  }

  /**
   * Parses the given text into an array of strings, using the specified
   * separator. If the parsing fails or the number of items in the list
   * doesn't match the expected length, throws an OutputParserException.
   * @param text The text to parse.
   * @returns An array of strings obtained by splitting the input text at each occurrence of the specified separator.
   */
  async parse(text: string): Promise<string[]> {
    try {
      const items = text
        .trim()
        .split(this.separator)
        .map((s) => s.trim());
      if (this.length !== undefined && items.length !== this.length) {
        throw new OutputParserException(
          `Incorrect number of items. Expected ${this.length}, got ${items.length}.`
        );
      }
      return items;
    } catch (e) {
      if (Object.getPrototypeOf(e) === OutputParserException.prototype) {
        throw e;
      }
      throw new OutputParserException(`Could not parse output: ${text}`);
    }
  }

  /**
   * Provides instructions on the expected format of the response for the
   * CustomListOutputParser, including the number of items and the
   * separator.
   * @returns A string containing instructions on the expected format of the response.
   */
  getFormatInstructions(): string {
    return `Your response should be a list of ${
      this.length === undefined ? "" : `${this.length} `
    }items separated by "${this.separator}" (eg: \`foo${this.separator} bar${
      this.separator
    } baz\`)`;
  }
}
