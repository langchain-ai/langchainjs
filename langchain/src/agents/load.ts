import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import { Agent } from "./agent.js";
import { Tool } from "../tools/base.js";
import { loadFromHub } from "../util/hub.js";
import { FileLoader, loadFromFile } from "../util/load.js";
import { parseFileConfig } from "../util/parse.js";

const loadAgentFromFile: FileLoader<Agent> = async (
  file: string,
  path: string,
  llmAndTools?: { llm?: BaseLanguageModelInterface; tools?: Tool[] }
) => {
  const serialized = parseFileConfig(file, path);
  return Agent.deserialize({ ...serialized, ...llmAndTools });
};

export const loadAgent = async (
  uri: string,
  llmAndTools?: { llm?: BaseLanguageModelInterface; tools?: Tool[] }
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
