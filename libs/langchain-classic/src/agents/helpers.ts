import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { ToolInterface } from "@langchain/core/tools";
import type { SerializedAgentT, AgentInput } from "./types.js";
import { LLMChain } from "../chains/llm_chain.js";

export async function deserializeHelper<
  T extends string,
  U extends Record<string, unknown>,
  V extends AgentInput,
  Z,
>(
  llm: BaseLanguageModelInterface | undefined,
  tools: ToolInterface[] | undefined,
  data: SerializedAgentT<T, U, V>,
  fromLLMAndTools: (
    llm: BaseLanguageModelInterface,
    tools: ToolInterface[],
    args: U
  ) => Z,
  fromConstructor: (args: V) => Z
): Promise<Z> {
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
}
