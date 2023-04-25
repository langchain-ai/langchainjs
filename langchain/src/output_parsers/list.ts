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
      throw new OutputParserException(`Could not parse output: ${text}`);
    }
  }

  getFormatInstructions(): string {
    return `Your response should be a list of comma separated values, eg: \`foo, bar, baz\``;
  }
}
