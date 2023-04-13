import { LLMChain } from "../chains/llm_chain.js";
import { SerializedLLMChain } from "../chains/serde.js";
import { BaseOutputParser, AgentAction, AgentFinish } from "../schema/index.js";

export interface AgentInput {
  llmChain: LLMChain;
  allowedTools?: string[];
}

export abstract class AgentActionOutputParser extends BaseOutputParser {
  abstract parse(text: string): Promise<AgentAction | AgentFinish>;
}

export type StoppingMethod = "force" | "generate";

export type SerializedAgentT<
  TType extends string = string,
  FromLLMInput extends Record<string, unknown> = Record<string, unknown>,
  ConstructorInput extends AgentInput = AgentInput
> = {
  _type: TType;
  llm_chain?: SerializedLLMChain;
} & (
  | ({ load_from_llm_and_tools: true } & FromLLMInput)
  | ({ load_from_llm_and_tools?: false } & ConstructorInput)
);

export type SerializedFromLLMAndTools = {
  suffix?: string;
  prefix?: string;
  input_variables?: string[];
};

export type SerializedZeroShotAgent = SerializedAgentT<
  "zero-shot-react-description",
  SerializedFromLLMAndTools,
  AgentInput
>;

export type SerializedAgent = SerializedZeroShotAgent;
