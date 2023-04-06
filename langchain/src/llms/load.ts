import { FileLoader, loadFromFile } from "../util/load.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { parseFileConfig } from "../util/parse.js";

/**
 * Load an LLM from a local file.
 *
 * @example
 * ```ts
 * import { loadLLM } from "langchain/llms";
 * const model = await loadLLM("/path/to/llm.json");
 * ```
 */
const loader: FileLoader<BaseLanguageModel> = (file: string, path: string) =>
  BaseLanguageModel.deserialize(parseFileConfig(file, path));

export const loadLLM = (uri: string): Promise<BaseLanguageModel> =>
  loadFromFile(uri, loader);
