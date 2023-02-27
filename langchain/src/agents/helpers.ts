import type { SerializedAgentT, AgentInput } from "./index.js";
import { Tool } from "./tools/index.js";
import { BaseLLM } from "../llms/index.js";
import { SerializedLLMChain, LLMChain } from "../chains/index.js";
import { resolveConfigFromFile } from "../util/index.js";

export const deserializeHelper = async <
  T extends string,
  U,
  V extends AgentInput,
  Z
>(
  llm: BaseLLM | undefined,
  tools: Tool[] | undefined,
  data: SerializedAgentT<T, U, V>,
  fromLLMAndTools: (llm: BaseLLM, tools: Tool[], args: U) => Z,
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

  const serializedLLMChain = await resolveConfigFromFile<
    "llm_chain",
    SerializedLLMChain
  >("llm_chain", data);
  const llmChain = await LLMChain.deserialize(serializedLLMChain);
  return fromConstructor({ ...data, llmChain });
};
