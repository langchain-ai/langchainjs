import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { ToolInterface } from "@langchain/core/tools";
import { Agent } from "./agent.js";
import { loadFromHub } from "../util/hub.js";
import { FileLoader, loadFromFile } from "../util/load.js";
import { parseFileConfig } from "../util/parse.js";

const loadAgentFromFile: FileLoader<Agent> = async (
  file: string,
  path: string,
  llmAndTools?: { llm?: BaseLanguageModelInterface; tools?: ToolInterface[] }
) => {
  const serialized = parseFileConfig(file, path);
  return Agent.deserialize({ ...serialized, ...llmAndTools });
};

export async function loadAgent(
  uri: string,
  llmAndTools?: { llm?: BaseLanguageModelInterface; tools?: ToolInterface[] }
): Promise<Agent> {
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
}
