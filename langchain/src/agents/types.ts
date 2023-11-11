import { LLMChain } from "../chains/llm_chain.js";
import { SerializedLLMChain } from "../chains/serde.js";
import {
  AgentAction,
  AgentFinish,
  BaseMessage,
  ChainValues,
} from "../schema/index.js";
import { BaseOutputParser } from "../schema/output_parser.js";
import { Runnable } from "../schema/runnable/base.js";

/**
 * Interface defining the input for creating an agent. It includes the
 * LLMChain instance, an optional output parser, and an optional list of
 * allowed tools.
 */
export interface AgentInput {
  llmChain: LLMChain;
  outputParser: AgentActionOutputParser | undefined;
  allowedTools?: string[];
}

/**
 * Interface defining the input for creating an agent that uses runnables.
 * It includes the Runnable instance, and an optional list of stop strings.
 */
export interface RunnableAgentInput {
  runnable: Runnable<
    ChainValues & {
      agent_scratchpad?: string | BaseMessage[];
      stop?: string[];
    },
    AgentAction[] | AgentAction | AgentFinish
  >;
  stop?: string[];
}

/**
 * Abstract class representing an output parser specifically for agent
 * actions and finishes in LangChain. It extends the `BaseOutputParser`
 * class.
 */
export abstract class AgentActionOutputParser extends BaseOutputParser<
  AgentAction | AgentFinish
> {}

/**
 * Abstract class representing an output parser specifically for agents
 * that return multiple actions.
 */
export abstract class AgentMultiActionOutputParser extends BaseOutputParser<
  AgentAction[] | AgentFinish
> {}

/**
 * Type representing the stopping method for an agent. It can be either
 * 'force' or 'generate'.
 */
export type StoppingMethod = "force" | "generate";

/**
 * Generic type representing a serialized agent in LangChain. It includes
 * the type of the agent, the serialized form of the LLMChain, and
 * additional properties specific to the agent type.
 */
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

/**
 * Type representing a serialized ZeroShotAgent in LangChain. It extends
 * the `SerializedAgentT` type and includes additional properties specific
 * to the ZeroShotAgent.
 */
export type SerializedZeroShotAgent = SerializedAgentT<
  "zero-shot-react-description",
  SerializedFromLLMAndTools,
  AgentInput
>;

/**
 * Type representing a serialized agent in LangChain. It is currently
 * synonymous with `SerializedZeroShotAgent`.
 */
export type SerializedAgent = SerializedZeroShotAgent;
