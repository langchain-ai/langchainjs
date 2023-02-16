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

/**
 * Class to parse the output of an LLM call to a list.
 * @augments BaseOutputParser
 */
export abstract class ListOutputParser extends BaseOutputParser {
  abstract parse(text: string): string[];
}

type SerializedCommaSeparatedListOutputParser = {
  _type: "comma_separated_list";
};

/**
 * Class to parse the output of an LLM call as a comma-separated list.
 * @augments ListOutputParser
 */
export class CommaSeparatedListOutputParser extends ListOutputParser {
  parse(text: string): string[] {
    return text.trim().split(", ");
  }

  serialize(): SerializedCommaSeparatedListOutputParser {
    return {
      _type: "comma_separated_list",
    };
  }

  static deserialize(
    _: SerializedCommaSeparatedListOutputParser
  ): CommaSeparatedListOutputParser {
    return new CommaSeparatedListOutputParser();
  }
}

type SerializedRegexParser = {
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

  serialize() {
    return {
      _type: "regex_parser" as const,
      regex: typeof this.regex === "string" ? this.regex : this.regex.source,
      output_keys: this.outputKeys,
      default_output_key: this.defaultOutputKey,
    };
  }

  static deserialize(data: SerializedRegexParser): RegexParser {
    return new RegexParser(
      data.regex,
      data.output_keys,
      data.default_output_key
    );
  }
}
