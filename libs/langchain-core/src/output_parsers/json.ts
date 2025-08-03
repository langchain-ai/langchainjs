import { BaseCumulativeTransformOutputParser } from "./transform.js";
import { Operation, compare } from "../utils/json_patch.js";
import { ChatGeneration, Generation } from "../outputs.js";
import { parseJsonMarkdown, parsePartialJson } from "../utils/json.js";

/**
 * Class for parsing the output of an LLM into a JSON object.
 */
export class JsonOutputParser<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
> extends BaseCumulativeTransformOutputParser<T> {
  static lc_name() {
    return "JsonOutputParser";
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

  // This should actually return Partial<T>, but there's no way
  // to specify emitted chunks as instances separate from the main output type.
  async parsePartialResult(
    generations: ChatGeneration[] | Generation[]
  ): Promise<T | undefined> {
    return parseJsonMarkdown(generations[0].text);
  }

  async parse(text: string): Promise<T> {
    return parseJsonMarkdown(text, JSON.parse);
  }

  getFormatInstructions(): string {
    return "";
  }
}

export { parsePartialJson, parseJsonMarkdown };
