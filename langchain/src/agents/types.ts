import { SerializedLLMChain } from "../chains/index.js";
import type { AgentInput } from "./index.js";

export type StoppingMethod = "force" | "generate";

export type SerializedAgentT<
  TType extends string,
  FromLLMInput,
  ConstructorInput extends AgentInput
> = {
  _type: TType;
  llm_chain?: SerializedLLMChain;
  llm_chain_path?: string;
} & (
  | ({ load_from_llm_and_tools: true } & FromLLMInput)
  | ({ load_from_llm_and_tools?: false } & ConstructorInput)
);
