import {
  BaseOutputParser,
  OutputParserException,
} from "../schema/output_parser.js";

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

  getFormatInstructions(): string {
    return `Your response should be a list of comma separated values, eg: \`foo, bar, baz\``;
  }
}

/**
 * Class to parse the output of an LLM call to a list with a specific length and separator.
 * @augments ListOutputParser
 */
export class CustomListOutputParser extends ListOutputParser {
  private length: number | undefined;

  private separator: string;

  constructor({ length, separator }: { length?: number; separator?: string }) {
    super();
    this.length = length;
    this.separator = separator || ",";
  }

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

  getFormatInstructions(): string {
    return `Your response should be a list of ${this.length} items separated by "${this.separator}" (eg: \`foo${this.separator} bar${this.separator} baz\`)`;
  }
}
