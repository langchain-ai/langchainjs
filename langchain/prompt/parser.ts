export type SerializedOutputParser =
  | SerializedRegexParser
  | SerializedCommaSeparatedListOutputParser;

export abstract class BaseOutputParser {
  abstract parse(text: string): string | string[] | Record<string, string>;

  _type(): string {
    throw new Error("_type not implemented");
  }

  abstract serialize(): SerializedOutputParser;

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

export abstract class ListOutputParser extends BaseOutputParser {
  abstract parse(text: string): string[];
}

type SerializedCommaSeparatedListOutputParser = {
  _type: "comma_separated_list";
};

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
