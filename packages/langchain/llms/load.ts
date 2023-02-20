import { BaseLLM } from "./base";
import { parseFileConfig } from "../util";

/**
 * Load an LLM from a local file.
 *
 * @example
 * ```ts
 * import { loadLLM } from "langchain/llms";
 * const model = await loadLLM("/path/to/llm.json");
 * ```
 */
export const loadLLM = (file: string) =>
  BaseLLM.deserialize(parseFileConfig(file));
