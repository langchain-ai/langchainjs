import { BasePromptTemplate } from "./index.js";
import { loadFromHub } from "../util/hub.js";
import { parseFileConfig, FileLoader, loadFromFile } from "../util/index.js";

const loadPromptFromFile: FileLoader<BasePromptTemplate> = (text, path) =>
  BasePromptTemplate.deserialize(parseFileConfig(text, path));

/**
 * Load a prompt from {@link https://github.com/hwchase17/langchain-hub | LangchainHub} or local filesystem.
 *
 * @example
 * Loading from LangchainHub:
 * ```ts
 * import { loadPrompt } from "langchain/prompts";
 * const prompt = await loadPrompt("lc://prompts/hello-world/prompt.yaml");
 * ```
 *
 * @example
 * Loading from local filesystem:
 * ```ts
 * import { loadPrompt } from "langchain/prompts";
 * const prompt = await loadPrompt("/path/to/prompt.json");
 * ```
 */
export const loadPrompt = async (uri: string): Promise<BasePromptTemplate> => {
  const hubResult = await loadFromHub(
    uri,
    loadPromptFromFile,
    "prompts",
    new Set(["py", "json", "yaml"])
  );
  if (hubResult) {
    return hubResult;
  }

  return loadFromFile(uri, loadPromptFromFile);
};
