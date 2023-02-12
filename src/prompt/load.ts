import { BasePromptTemplate } from ".";
import { loadFromHub } from "../util/hub";
import { parseFileConfig } from "../util";

const loadPromptFromFile = async (file: string) =>
  BasePromptTemplate.deserialize(parseFileConfig(file));

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
