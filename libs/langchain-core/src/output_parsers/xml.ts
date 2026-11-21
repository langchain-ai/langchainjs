import {
  BaseCumulativeTransformOutputParser,
  BaseCumulativeTransformOutputParserInput,
} from "./transform.js";
import { Operation, compare } from "../utils/json_patch.js";
import { sax } from "../utils/sax-js/sax.js";
import { ChatGeneration, Generation } from "../outputs.js";

export const XML_FORMAT_INSTRUCTIONS = `The output should be formatted as a XML file.
1. Output should conform to the tags below.
2. If tags are not given, make them on your own.
3. Remember to always open and close all the tags.

As an example, for the tags ["foo", "bar", "baz"]:
1. String "<foo>\n   <bar>\n      <baz></baz>\n   </bar>\n</foo>" is a well-formatted instance of the schema.
2. String "<foo>\n   <bar>\n   </foo>" is a badly-formatted instance.
3. String "<foo>\n   <tag>\n   </tag>\n</foo>" is a badly-formatted instance.

Here are the output tags:
\`\`\`
{tags}
\`\`\``;

export interface XMLOutputParserFields extends BaseCumulativeTransformOutputParserInput {
  /**
   * Optional list of tags that the output should conform to.
   * Only used in formatting of the prompt.
   */
  tags?: string[];
}

export type Content = string | undefined | Array<{ [key: string]: Content }>;

export type XMLResult = {
  [key: string]: Content;
};

export class XMLOutputParser extends BaseCumulativeTransformOutputParser<XMLResult> {
  tags?: string[];

  constructor(fields?: XMLOutputParserFields) {
    super(fields);

    this.tags = fields?.tags;
  }

  static lc_name() {
    return "XMLOutputParser";
  }

  lc_namespace = ["langchain_core", "output_parsers"];

  lc_serializable = true;

  protected _diff(
    prev: unknown | undefined,
    next: unknown
  ): Operation[] | undefined {
    if (!next) {
      return undefined;
    }
    if (!prev) {
      return [{ op: "replace", path: "", value: next }];
    }
    return compare(prev, next);
  }

  async parsePartialResult(
    generations: ChatGeneration[] | Generation[]
  ): Promise<XMLResult | undefined> {
    return parseXMLMarkdown(generations[0].text);
  }

  async parse(text: string): Promise<XMLResult> {
    return parseXMLMarkdown(text);
  }

  getFormatInstructions(): string {
    const withTags = !!(this.tags && this.tags.length > 0);
    return withTags
      ? XML_FORMAT_INSTRUCTIONS.replace("{tags}", this.tags?.join(", ") ?? "")
      : XML_FORMAT_INSTRUCTIONS;
  }
}

const strip = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/^\s+/, ""))
    .join("\n")
    .trim();

type ParsedResult = {
  name: string;
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  attributes: Record<string, any>;
  children: Array<ParsedResult>;
  text?: string;
  isSelfClosing: boolean;
};

const parseParsedResult = (input: ParsedResult): XMLResult => {
  if (Object.keys(input).length === 0) {
    return {};
  }
  const result: XMLResult = {};
  if (input.children.length > 0) {
    result[input.name] = input.children.map(parseParsedResult);
    return result;
  } else {
    result[input.name] = input.text ?? undefined;
    return result;
  }
};

/**
 * Extract the raw XML from a string that may be wrapped in a ```xml fence.
 *
 * LLMs commonly wrap XML in a markdown fence, and when the output is streamed
 * the parser sees partial results where that fence is incomplete: a leading
 * "`", "```xm", or an opening fence with no closing fence yet. Treat
 * end-of-input as a closing fence so those partial results stay parseable.
 */
function extractXMLString(cleanedString: string): string {
  if (cleanedString.startsWith("`")) {
    let text = cleanedString.replace(/^`+/, "");
    text = text.replace(/^\s*xml[ \t]*\r?\n?/i, "");
    // Still inside the fence prefix (e.g. "`", "``", "```xm"): no XML yet.
    if (!text.includes("<")) {
      return "";
    }
    return text.replace(/\s*`+\s*$/, "");
  }

  const match = /```(?:xml)?\s*([\s\S]*?)(?:```|$)/i.exec(cleanedString);
  return match ? match[1] : cleanedString;
}

export function parseXMLMarkdown(s: string): XMLResult {
  const cleanedString = strip(s);
  const parser = sax.parser(true);
  let parsedResult: ParsedResult = {} as ParsedResult;
  const elementStack: ParsedResult[] = [];

  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  parser.onopentag = (node: any) => {
    const element = {
      name: node.name,
      attributes: node.attributes,
      children: [],
      text: "",
      isSelfClosing: node.isSelfClosing,
    };

    if (elementStack.length > 0) {
      const parentElement = elementStack[elementStack.length - 1];
      parentElement.children.push(element);
    } else {
      parsedResult = element as ParsedResult;
    }

    if (!node.isSelfClosing) {
      elementStack.push(element);
    }
  };

  parser.onclosetag = () => {
    if (elementStack.length > 0) {
      const lastElement = elementStack.pop();
      if (elementStack.length === 0 && lastElement) {
        parsedResult = lastElement as ParsedResult;
      }
    }
  };

  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  parser.ontext = (text: any) => {
    if (elementStack.length > 0) {
      const currentElement = elementStack[elementStack.length - 1];
      currentElement.text += text;
    }
  };

  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  parser.onattribute = (attr: any) => {
    if (elementStack.length > 0) {
      const currentElement = elementStack[elementStack.length - 1];
      currentElement.attributes[attr.name] = attr.value;
    }
  };

  // Try to find XML string within triple backticks.
  // While streaming, the accumulated text can end up with a partial opening
  // fence ("`", "```xm") or no closing fence at all, so strip whatever fence
  // characters are present instead of requiring a complete pair.
  const xmlString = extractXMLString(cleanedString);
  parser.write(xmlString).close();

  // Remove the XML declaration if present
  if (parsedResult && parsedResult.name === "?xml") {
    parsedResult = parsedResult.children[0] as ParsedResult;
  }

  return parseParsedResult(parsedResult);
}
