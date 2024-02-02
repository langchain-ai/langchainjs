import { XMLParser } from "fast-xml-parser";
import { Operation, compare } from "../utils/json_patch.js";
import { ChatGeneration, Generation } from "../outputs.js";
import { BaseOutputParser } from "./base.js";

export class XMLOutputParser<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
> extends BaseOutputParser<T> {
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
  ): Promise<T | undefined> {
    return parseXMLMarkdown<T>(generations[0].text);
  }

  async parse(text: string): Promise<T> {
    return parseXMLMarkdown<T>(text);
  }

  getFormatInstructions(): string {
    return "";
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
    console.log(newString);
    parsedResult = {} as T;
    // If match found, use the content within the backticks
    // parsedResult = parser.parse(newString);
  } else {
    parsedResult = parser.parse(match[2]);
  }

  if (parsedResult && "?xml" in parsedResult) {
    delete parsedResult["?xml"];
  }
  return parsedResult;
}
