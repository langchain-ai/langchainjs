import {
  BaseOutputParser,
  OutputParserException,
} from "../schema/output_parser.js";

/**
 * Class to parse the output of an LLM call into a dictionary.
 * @augments BaseOutputParser
 */
export class RegexParser extends BaseOutputParser<Record<string, string>> {
  regex: string | RegExp;

  outputKeys: string[];

  defaultOutputKey?: string;

  constructor(
    regex: string | RegExp,
    outputKeys: string[],
    defaultOutputKey?: string
  ) {
    super();
    this.regex = typeof regex === "string" ? new RegExp(regex) : regex;
    this.outputKeys = outputKeys;
    this.defaultOutputKey = defaultOutputKey;
  }

  _type() {
    return "regex_parser";
  }

  async parse(text: string): Promise<Record<string, string>> {
    const match = text.match(this.regex);
    if (match) {
      return this.outputKeys.reduce((acc, key, index) => {
        acc[key] = match[index + 1];
        return acc;
      }, {} as Record<string, string>);
    }

    if (this.defaultOutputKey === undefined) {
      throw new OutputParserException(`Could not parse output: ${text}`, text);
    }

    return this.outputKeys.reduce((acc, key) => {
      acc[key] = key === this.defaultOutputKey ? text : "";
      return acc;
    }, {} as Record<string, string>);
  }

  getFormatInstructions(): string {
    return `Your response should match the following regex: ${this.regex}`;
  }
}
