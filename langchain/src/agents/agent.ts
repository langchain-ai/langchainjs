import { BaseLanguageModel } from "../base_language/index.js";
import { CallbackManager, Callbacks } from "../callbacks/manager.js";
import { LLMChain } from "../chains/llm_chain.js";
import { BasePromptTemplate } from "../prompts/base.js";
import {
  AgentAction,
  AgentFinish,
  AgentStep,
  BaseChatMessage,
  ChainValues,
} from "../schema/index.js";
import { Tool } from "../tools/base.js";
import {
  AgentActionOutputParser,
  AgentInput,
  SerializedAgent,
  StoppingMethod,
} from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OutputParserArgs = Record<string, any>;

class ParseError extends Error {
  output: string;

  constructor(msg: string, output: string) {
    super(msg);
    this.output = output;
  }
}

export abstract class BaseAgent {
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
   * Return the string type key uniquely identifying multi or single action agents.
   */
  abstract _agentActionType(): string;

  /**
   * Return response when agent has been stopped due to max iterations
   */
  returnStoppedResponse(
    earlyStoppingMethod: StoppingMethod,
    _steps: AgentStep[],
    _inputs: ChainValues,
    _callbackManager?: CallbackManager
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

export abstract class BaseSingleActionAgent extends BaseAgent {
  _agentActionType(): string {
    return "single" as const;
  }

  /**
   * Decide what to do, given some input.
   *
   * @param steps - Steps the LLM has taken so far, along with observations from each.
   * @param inputs - User inputs.
   * @param callbackManager - Callback manager.
   *
   * @returns Action specifying what tool to use.
   */
  abstract plan(
    steps: AgentStep[],
    inputs: ChainValues,
    callbackManager?: CallbackManager
  ): Promise<AgentAction | AgentFinish>;
}

export abstract class BaseMultiActionAgent extends BaseAgent {
  _agentActionType(): string {
    return "multi" as const;
  }

  /**
   * Decide what to do, given some input.
   *
   * @param steps - Steps the LLM has taken so far, along with observations from each.
   * @param inputs - User inputs.
   * @param callbackManager - Callback manager.
   *
   * @returns Actions specifying what tools to use.
   */
  abstract plan(
    steps: AgentStep[],
    inputs: ChainValues,
    callbackManager?: CallbackManager
  ): Promise<AgentAction[] | AgentFinish>;
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
   * @param callbackManager - Callback manager.
   *
   * @returns Action specifying what tool to use.
   */
  async plan(
    steps: AgentStep[],
    inputs: ChainValues,
    callbackManager?: CallbackManager
  ): Promise<AgentAction | AgentFinish> {
    const output = await this.llmChain.call(
      {
        intermediate_steps: steps,
        stop: this.stop,
        ...inputs,
      },
      callbackManager
    );
    return this.outputParser.parse(
      output[this.llmChain.outputKey],
      callbackManager
    );
  }
}

export interface AgentArgs {
  outputParser?: AgentActionOutputParser;

  callbacks?: Callbacks;

  /**
   * @deprecated Use `callbacks` instead.
   */
  callbackManager?: CallbackManager;
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

  outputParser: AgentActionOutputParser;

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
    this.outputParser = input.outputParser;
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
   * Get the default output parser for this agent.
   */
  static getDefaultOutputParser(
    _fields?: OutputParserArgs
  ): AgentActionOutputParser {
    throw new Error("Not implemented");
  }

  /**
   * Create a prompt for this class
   *
   * @param _tools - List of tools the agent will have access to, used to format the prompt.
   * @param _fields - Additional fields used to format the prompt.
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
    _args?: AgentArgs
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
  async constructScratchPad(
    steps: AgentStep[]
  ): Promise<string | BaseChatMessage[]> {
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
    suffix?: string,
    callbackManager?: CallbackManager
  ): Promise<AgentAction | AgentFinish> {
    const thoughts = await this.constructScratchPad(steps);
    const newInputs: ChainValues = {
      ...inputs,
      agent_scratchpad: suffix ? `${thoughts}${suffix}` : thoughts,
    };

    if (this._stop().length !== 0) {
      newInputs.stop = this._stop();
    }

    const output = await this.llmChain.predict(newInputs, callbackManager);
    return this.outputParser.parse(output, callbackManager);
  }

  /**
   * Decide what to do given some input.
   *
   * @param steps - Steps the LLM has taken so far, along with observations from each.
   * @param inputs - User inputs.
   * @param callbackManager - Callback manager to use for this call.
   *
   * @returns Action specifying what tool to use.
   */
  plan(
    steps: AgentStep[],
    inputs: ChainValues,
    callbackManager?: CallbackManager
  ): Promise<AgentAction | AgentFinish> {
    return this._plan(steps, inputs, undefined, callbackManager);
  }

  /**
   * Return response when agent has been stopped due to max iterations
   */
  async returnStoppedResponse(
    earlyStoppingMethod: StoppingMethod,
    steps: AgentStep[],
    inputs: ChainValues,
    callbackManager?: CallbackManager
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
          "\n\nI now need to return a final answer based on the previous steps:",
          callbackManager
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
