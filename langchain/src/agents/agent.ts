import { BaseLanguageModel } from "../base_language/index.js";
import { LLMChain } from "../chains/llm_chain.js";
import { BasePromptTemplate } from "../prompts/index.js";
import {
  AgentAction,
  AgentFinish,
  AgentStep,
  ChainValues,
  BaseChatMessage,
} from "../schema/index.js";
import { AgentInput, SerializedAgent, StoppingMethod } from "./types.js";
import { Tool } from "./tools/base.js";

class ParseError extends Error {
  output: string;

  constructor(msg: string, output: string) {
    super(msg);
    this.output = output;
  }
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
  async extractToolAndInput(
    _input: string
  ): Promise<{ tool: string; input: string } | null> {
    throw new Error("Not implemented");
  }

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
   * Prepare the agent for output, if needed
   */
  async prepareForOutput(
    _returnValues: AgentFinish["returnValues"],
    _steps: AgentStep[]
  ): Promise<AgentFinish["returnValues"]> {
    return {};
  }

  /**
   * Create a prompt for this class
   *
   * @param tools - List of tools the agent will have access to, used to format the prompt.
   * @param fields - Additional fields used to format the prompt.
   *
   * @returns A PromptTemplate assembled from the given tools and fields.
   * */
  static createPrompt(
    _tools: Tool[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _fields?: Record<string, any>
  ): BasePromptTemplate {
    throw new Error("Not implemented");
  }

  /** Construct an agent from an LLM and a list of tools */
  static fromLLMAndTools(
    _llm: BaseLanguageModel,
    _tools: Tool[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _args?: Record<string, any>
  ): Agent {
    throw new Error("Not implemented");
  }

  /**
   * Validate that appropriate tools are passed in
   */
  static validateTools(_tools: Tool[]): void {}

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
  constructScratchPad(steps: AgentStep[]): string | BaseChatMessage[] {
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
    };

    if (this._stop().length !== 0) {
      newInputs.stop = this._stop();
    }

    const output = await this.llmChain.predict(newInputs);
    const parsed = await this.extractToolAndInput(output);
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
    data: SerializedAgent & { llm?: BaseLanguageModel; tools?: Tool[] }
  ): Promise<Agent> {
    switch (data._type) {
      case "zero-shot-react-description": {
        const { ZeroShotAgent } = await import("./mrkl/index.js");
        return ZeroShotAgent.deserialize(data);
      }
      default:
        throw new Error("Unknown agent type");
    }
  }
}
