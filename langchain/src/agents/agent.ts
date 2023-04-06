import { BaseLanguageModel } from "../base_language/index.js";
import { LLMChain } from "../chains/llm_chain.js";
import { BasePromptTemplate } from "../prompts/base.js";
import {
  AgentAction,
  AgentFinish,
  AgentStep,
  ChainValues,
  BaseChatMessage,
} from "../schema/index.js";
import {
  AgentInput,
  SerializedAgent,
  StoppingMethod,
  AgentActionOutputParser,
} from "./types.js";
import { Tool } from "./tools/base.js";

class ParseError extends Error {
  output: string;

  constructor(msg: string, output: string) {
    super(msg);
    this.output = output;
  }
}

export abstract class BaseSingleActionAgent {
  abstract get inputKeys(): string[];

  get returnValues(): string[] {
    return ["output"];
  }

  get allowedTools(): string[] | undefined {
    return undefined;
  }

  /**
   * Return the string type key uniquely identifying this class of agent.
   */
  _agentType(): string {
    throw new Error("Not implemented");
  }

  /**
   * Decide what to do given some input.
   *
   * @param steps - Steps the LLM has taken so far, along with observations from each.
   * @param inputs - User inputs.
   *
   * @returns Action specifying what tool to use.
   */
  abstract plan(
    steps: AgentStep[],
    inputs: ChainValues
  ): Promise<AgentAction | AgentFinish>;

  /**
   * Return response when agent has been stopped due to max iterations
   */
  returnStoppedResponse(
    earlyStoppingMethod: StoppingMethod,
    _steps: AgentStep[],
    _inputs: ChainValues
  ): Promise<AgentFinish> {
    if (earlyStoppingMethod === "force") {
      return Promise.resolve({
        returnValues: { output: "Agent stopped due to max iterations." },
        log: "",
      });
    }

    throw new Error(`Invalid stopping method: ${earlyStoppingMethod}`);
  }

  /**
   * Prepare the agent for output, if needed
   */
  async prepareForOutput(
    _returnValues: AgentFinish["returnValues"],
    _steps: AgentStep[]
  ): Promise<AgentFinish["returnValues"]> {
    return {};
  }
}

export interface LLMSingleActionAgentInput {
  llmChain: LLMChain;
  outputParser: AgentActionOutputParser;
  stop?: string[];
}

export class LLMSingleActionAgent extends BaseSingleActionAgent {
  llmChain: LLMChain;

  outputParser: AgentActionOutputParser;

  stop?: string[];

  constructor(input: LLMSingleActionAgentInput) {
    super();
    this.stop = input.stop;
    this.llmChain = input.llmChain;
    this.outputParser = input.outputParser;
  }

  get inputKeys(): string[] {
    return this.llmChain.inputKeys;
  }

  /**
   * Decide what to do given some input.
   *
   * @param steps - Steps the LLM has taken so far, along with observations from each.
   * @param inputs - User inputs.
   *
   * @returns Action specifying what tool to use.
   */
  async plan(
    steps: AgentStep[],
    inputs: ChainValues
  ): Promise<AgentAction | AgentFinish> {
    const output = await this.llmChain.call({
      intermediate_steps: steps,
      stop: this.stop,
      ...inputs,
    });
    return this.outputParser.parse(output[this.llmChain.outputKey]);
  }
}

/**
 * Class responsible for calling a language model and deciding an action.
 *
 * @remarks This is driven by an LLMChain. The prompt in the LLMChain *must*
 * include a variable called "agent_scratchpad" where the agent can put its
 * intermediary work.
 */
export abstract class Agent extends BaseSingleActionAgent {
  llmChain: LLMChain;

  private _allowedTools?: string[] = undefined;

  get allowedTools(): string[] | undefined {
    return this._allowedTools;
  }

  get inputKeys(): string[] {
    return this.llmChain.inputKeys.filter((k) => k !== "agent_scratchpad");
  }

  constructor(input: AgentInput) {
    super();
    this.llmChain = input.llmChain;
    this._allowedTools = input.allowedTools;
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
        // fine to use instanceof because we're in the same module
        // eslint-disable-next-line no-instanceof/no-instanceof
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
