import { XMLParser } from "fast-xml-parser";
import { BaseOutputParser } from "./base.js";

export const XML_FORMAT_INSTRUCTIONS = `The output should be formatted as a XML file.
1. Output should conform to the tags below. 
2. If tags are not given, make them on your own.
3. Remember to always open and close all the tags.

As an example, for the tags ["foo", "bar", "baz"]:
1. String "<foo>\n   <bar>\n      <baz></baz>\n   </bar>\n</foo>" is a well-formatted instance of the schema. 
2. String "<foo>\n   <bar>\n   </foo>" is a badly-formatted instance.
3. String "<foo>\n   <tag>\n   </tag>\n</foo>" is a badly-formatted instance.

Here are the output tags:
\`\`\
{tags}
\`\`\``;

export interface XMLOutputParserFields {
  /**
   * Optional list of tags that the output should conform to.
   * Only used in formatting of the prompt.
   */
  tags?: string[];
}

export class XMLOutputParser<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
> extends BaseOutputParser<T> {
  tags?: string[];

  constructor(fields?: XMLOutputParserFields) {
    super();
    this.tags = fields?.tags;
  }

  static lc_name() {
    return "XMLOutputParser";
  }

  lc_namespace = ["langchain_core", "output_parsers"];

  lc_serializable = true;

  async parse(text: string): Promise<T> {
    return parseXMLMarkdown<T>(text);
  }

  getFormatInstructions(): string {
    const withTags = !!(this.tags && this.tags.length > 0);
    return withTags
      ? XML_FORMAT_INSTRUCTIONS.replace("{tags}", this.tags?.join(", ") ?? "")
      : XML_FORMAT_INSTRUCTIONS;
  }
}

export function parseXMLMarkdown<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
>(s: string) {
  const parser = new XMLParser();
  const newString = s.trim();
  // Try to find XML string within triple backticks.
  const match = /```(xml)?(.*)```/s.exec(newString);
  let parsedResult: T;
  if (!match) {
    // If match found, use the content within the backticks
    parsedResult = parser.parse(newString);
  } else {
    parsedResult = parser.parse(match[2]);
  }

  if (parsedResult && "?xml" in parsedResult) {
    delete parsedResult["?xml"];
  }
  return parsedResult;
}
