import { Agent, Tool } from ".";
import { BaseLLM } from "../llms";
import { loadFromHub } from "../util/hub";
import { parseFileConfig } from "../util";

const loadAgentFromFile = async (
  file: string,
  llmAndTools?: { llm?: BaseLLM; tools?: Tool[] }
) => {
  const serialized = parseFileConfig(file);
  return Agent.deserialize({ ...serialized, ...llmAndTools });
};

export const loadAgent = async (
  uri: string,
  llmAndTools?: { llm?: BaseLLM; tools?: Tool[] }
): Promise<Agent> => {
  const hubResult = await loadFromHub(
    uri,
    (u) => loadAgentFromFile(u, llmAndTools),
    "agents",
    new Set(["json", "yaml"])
  );
  if (hubResult) {
    return hubResult;
  }

  return loadAgentFromFile(uri, llmAndTools);
};
