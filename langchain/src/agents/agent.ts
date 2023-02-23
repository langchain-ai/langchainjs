import { ChainValues } from "../chains/index.js";
import {
  ZeroShotAgent,
  SerializedZeroShotAgent,
  AgentAction,
  AgentFinish,
  AgentStep,
  StoppingMethod,
  Tool,
} from "./index.js";
import { BaseLLM } from "../llms/index.js";
import { LLMChain } from "../chains/llm_chain.js";
import { BasePromptTemplate } from "../prompts/index.js";

class ParseError extends Error {
  output: string;

  constructor(msg: string, output: string) {
    super(msg);
    this.output = output;
  }
}

// Hacky workaround to add static abstract methods. See detailed description of
// issue here: https://stackoverflow.com/a/65847601
export interface StaticAgent {
  /**
   * Create a prompt for this class
   *
   * @param tools - List of tools the agent will have access to, used to format the prompt.
   * @param fields - Additional fields used to format the prompt.
   *
   * @returns A PromptTemplate assembled from the given tools and fields.
   * */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createPrompt(tools: Tool[], fields?: Record<string, any>): BasePromptTemplate;
  /** Construct an agent from an LLM and a list of tools */
  fromLLMAndTools(
    llm: BaseLLM,
    tools: Tool[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args?: Record<string, any>
  ): Agent;
  validateTools(_: Tool[]): void;
}

export const staticImplements = <T>(_: T) => {};

type SerializedAgent = SerializedZeroShotAgent;

export interface AgentInput {
  llmChain: LLMChain;
  allowedTools?: string[];
}

/**
 * Class responsible for calling a language model and deciding an action.
 *
 * @remarks This is driven by an LLMChain. The prompt in the LLMChain *must*
 * include a variable called "agent_scratchpad" where the agent can put its
 * intermediary work.
 */
export abstract class Agent {
  llmChain: LLMChain;

  allowedTools?: string[] = undefined;

  returnValues = ["output"];

  get inputKeys(): string[] {
    return this.llmChain.inputKeys.filter((k) => k !== "agent_scratchpad");
  }

  constructor(input: AgentInput) {
    this.llmChain = input.llmChain;
    this.allowedTools = input.allowedTools;
  }

  /**
   * Extract tool and tool input from LLM output.
   */
  abstract extractToolAndInput(
    input: string
  ): { tool: string; input: string } | null;

  /**
   * Prefix to append the observation with.
   */
  abstract observationPrefix(): string;

  /**
   * Prefix to append the LLM call with.
   */
  abstract llmPrefix(): string;

  /**
   * Return the string type key uniquely identifying this class of agent.
   */
  abstract _agentType(): string;

  /**
   * Prepare the agent for a new call, if needed
   */
  prepareForNewCall(): void {}

  /**
   * Validate that appropriate tools are passed in
   */
  // eslint-disable-next-line no-unused-vars
  static validateTools(_: Tool[]): void {}

  _stop(): string[] {
    return [`\n${this.observationPrefix()}`];
  }

  /**
   * Name of tool to use to terminate the chain.
   */
  finishToolName(): string {
    return "Final Answer";
  }

  /**
   * Construct a scratchpad to let the agent continue its thought process
   */
  private constructScratchPad(steps: AgentStep[]): string {
    return steps.reduce(
      (thoughts, { action, observation }) =>
        thoughts +
        [
          action.log,
          `${this.observationPrefix()}${observation}`,
          this.llmPrefix(),
        ].join("\n"),
      ""
    );
  }

  private async _plan(
    steps: AgentStep[],
    inputs: ChainValues,
    suffix?: string
  ): Promise<AgentAction | AgentFinish> {
    const thoughts = this.constructScratchPad(steps);
    const newInputs: ChainValues = {
      ...inputs,
      agent_scratchpad: suffix ? `${thoughts}${suffix}` : thoughts,
      stop: this._stop(),
    };
    const output = await this.llmChain.predict(newInputs);
    const parsed = this.extractToolAndInput(output);
    if (!parsed) {
      throw new ParseError(`Invalid output: ${output}`, output);
    }
    const action = {
      tool: parsed.tool,
      toolInput: parsed.input,
      log: output,
    };
    if (action.tool === this.finishToolName()) {
      return { returnValues: { output: action.toolInput }, log: action.log };
    }
    return action;
  }

  /**
   * Decide what to do given some input.
   *
   * @param steps - Steps the LLM has taken so far, along with observations from each.
   * @param inputs - User inputs.
   *
   * @returns Action specifying what tool to use.
   */
  plan(
    steps: AgentStep[],
    inputs: ChainValues
  ): Promise<AgentAction | AgentFinish> {
    return this._plan(steps, inputs);
  }

  /**
   * Return response when agent has been stopped due to max iterations
   */
  async returnStoppedResponse(
    earlyStoppingMethod: StoppingMethod,
    steps: AgentStep[],
    inputs: ChainValues
  ): Promise<AgentFinish> {
    if (earlyStoppingMethod === "force") {
      return {
        returnValues: { output: "Agent stopped due to max iterations." },
        log: "",
      };
    }

    if (earlyStoppingMethod === "generate") {
      try {
        const action = await this._plan(
          steps,
          inputs,
          "\n\nI now need to return a final answer based on the previous steps:"
        );
        if ("returnValues" in action) {
          return action;
        }

        return { returnValues: { output: action.log }, log: action.log };
      } catch (err) {
        if (!(err instanceof ParseError)) {
          throw err;
        }
        return { returnValues: { output: err.output }, log: err.output };
      }
    }

    throw new Error(`Invalid stopping method: ${earlyStoppingMethod}`);
  }

  /**
   * Load an agent from a json-like object describing it.
   */
  static async deserialize(
    data: SerializedAgent & { llm?: BaseLLM; tools?: Tool[] }
  ): Promise<Agent> {
    switch (data._type) {
      case "zero-shot-react-description":
        return ZeroShotAgent.deserialize(data);
      default:
        throw new Error("Unknown agent type");
    }
  }
}
