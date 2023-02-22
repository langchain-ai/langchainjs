import { Agent, Tool } from ".";
import { BaseLLM } from "../llms";
import { loadFromHub } from "../util/hub";
import { FileLoader, loadFromFile, parseFileConfig } from "../util";

const loadAgentFromFile: FileLoader<Agent> = async (
  file: string,
  path: string,
  llmAndTools?: { llm?: BaseLLM; tools?: Tool[] }
) => {
  const serialized = parseFileConfig(file, path);
  return Agent.deserialize({ ...serialized, ...llmAndTools });
};

export const loadAgent = async (
  uri: string,
  llmAndTools?: { llm?: BaseLLM; tools?: Tool[] }
): Promise<Agent> => {
  const hubResult = await loadFromHub(
    uri,
    loadAgentFromFile,
    "agents",
    new Set(["json", "yaml"]),
    llmAndTools
  );
  if (hubResult) {
    return hubResult;
  }

  return loadFromFile(uri, loadAgentFromFile, llmAndTools);
};
