import { BaseOutputParser } from "../schema/output_parser.js";

export class NoOpOutputParser extends BaseOutputParser<string> {
  lc_namespace = ["langchain", "output_parsers", "default"];

  lc_serializable = true;

  parse(text: string): Promise<string> {
    return Promise.resolve(text);
  }

  getFormatInstructions(): string {
    return "";
  }
}
