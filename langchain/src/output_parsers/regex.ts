import { BaseOutputParser } from "./base.js";

export type SerializedRegexParser = {
  _type: "regex_parser";
  regex: string;
  output_keys: string[];
  default_output_key?: string;
};

/**
 * Class to parse the output of an LLM call into a dictionary.
 * @augments BaseOutputParser
 */
export class RegexParser extends BaseOutputParser {
  regex: string | RegExp;

  outputKeys: string[];

  defaultOutputKey?: string;

  constructor(
    regex: string | RegExp,
    outputKeys: string[],
    defaultOutputKey?: string
  ) {
    super();
    this.regex = regex;
    this.outputKeys = outputKeys;
    this.defaultOutputKey = defaultOutputKey;
  }

  _type() {
    return "regex_parser";
  }

  parse(text: string): Record<string, string> {
    const match = text.match(this.regex);
    if (match) {
      return this.outputKeys.reduce((acc, key, index) => {
        acc[key] = match[index + 1];
        return acc;
      }, {} as Record<string, string>);
    }

    if (this.defaultOutputKey === undefined) {
      throw new Error(`Could not parse output: ${text}`);
    }

    return this.outputKeys.reduce((acc, key) => {
      acc[key] = key === this.defaultOutputKey ? text : "";
      return acc;
    }, {} as Record<string, string>);
  }

  getFormatInstructions(): string {
    return `Your response should match the following regex: /${this.regex}/`;
  }

  serialize() {
    return {
      _type: "regex_parser" as const,
      regex: typeof this.regex === "string" ? this.regex : this.regex.source,
      output_keys: this.outputKeys,
      default_output_key: this.defaultOutputKey,
    };
  }

  static async deserialize(data: SerializedRegexParser): Promise<RegexParser> {
    return new RegexParser(
      data.regex,
      data.output_keys,
      data.default_output_key
    );
  }
}
