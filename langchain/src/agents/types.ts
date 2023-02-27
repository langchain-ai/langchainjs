import { SerializedLLMChain } from "../chains/index.js";
import type { AgentInput } from "./index.js";

export type AgentAction = {
  tool: string;
  toolInput: string;
  log: string;
};

export type AgentFinish = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  returnValues: Record<string, any>;
  log: string;
};

export type AgentStep = {
  action: AgentAction;
  observation: string;
};

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
