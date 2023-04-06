import type { SerializedAgentT, AgentInput } from "./types.js";
import { Tool } from "./tools/index.js";
import { LLMChain } from "../chains/index.js";
import { BaseLanguageModel } from "../base_language/index.js";

export const deserializeHelper = async <
  T extends string,
  U extends Record<string, unknown>,
  V extends AgentInput,
  Z
>(
  llm: BaseLanguageModel | undefined,
  tools: Tool[] | undefined,
  data: SerializedAgentT<T, U, V>,
  fromLLMAndTools: (llm: BaseLanguageModel, tools: Tool[], args: U) => Z,
  fromConstructor: (args: V) => Z
): Promise<Z> => {
  if (data.load_from_llm_and_tools) {
    if (!llm) {
      throw new Error("Loading from llm and tools, llm must be provided.");
    }

    if (!tools) {
      throw new Error("Loading from llm and tools, tools must be provided.");
    }

    return fromLLMAndTools(llm, tools, data);
  }
  if (!data.llm_chain) {
    throw new Error("Loading from constructor, llm_chain must be provided.");
  }

  const llmChain = await LLMChain.deserialize(data.llm_chain);
  return fromConstructor({ ...data, llmChain });
};
