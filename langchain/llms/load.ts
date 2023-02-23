import { BaseLLM } from "./base.js";
import { FileLoader, loadFromFile, parseFileConfig } from "../util/index.js";

/**
 * Load an LLM from a local file.
 *
 * @example
 * ```ts
 * import { loadLLM } from "langchain/llms";
 * const model = await loadLLM("/path/to/llm.json");
 * ```
 */
const loader: FileLoader<BaseLLM> = (file: string, path: string) =>
  BaseLLM.deserialize(parseFileConfig(file, path));

export const loadLLM = (uri: string): Promise<BaseLLM> =>
  loadFromFile(uri, loader);
