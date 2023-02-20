import { BasePromptTemplate } from ".";
import { loadFromHub } from "../util/hub";
import { parseFileConfig } from "../util";

const loadPromptFromFile = async (file: string) =>
  BasePromptTemplate.deserialize(parseFileConfig(file));

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

  return loadPromptFromFile(uri);
};
