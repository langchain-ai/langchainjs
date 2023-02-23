import { Agent, Tool } from "./index.js";
import { BaseLLM } from "../llms/index.js";
import { loadFromHub } from "../util/hub.js";
import { parseFileConfig } from "../util/index.js";

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
