import { BaseTransformOutputParser } from "./transform.js";

/**
 * OutputParser that parses LLMResult into the top likely string and
 * encodes it into bytes.
 */
export class BytesOutputParser extends BaseTransformOutputParser<Uint8Array> {
  static lc_name() {
    return "BytesOutputParser";
  }

  lc_namespace = ["langchain_core", "output_parsers", "bytes"];

  lc_serializable = true;

  protected textEncoder = new TextEncoder();

  parse(text: string): Promise<Uint8Array> {
    return Promise.resolve(this.textEncoder.encode(text));
  }

  getFormatInstructions(): string {
    return "";
  }
}
