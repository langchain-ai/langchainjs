export type SerializedRegexParser = {
  _type: "regex_parser";
  regex: string;
  output_keys: string[];
  default_output_key?: string;
};

export type SerializedCommaSeparatedListOutputParser = {
  _type: "comma_separated_list";
};

export type SerializedKeyValueOutputParser = {
  _type: "key_value";
  keys: string[];
};

export type SerializedOutputParser =
  | SerializedRegexParser
  | SerializedCommaSeparatedListOutputParser
  | SerializedKeyValueOutputParser;
