import { ChainValues } from "../chains";
import {
  ZeroShotAgent,
  SerializedZeroShotAgent,
  AgentAction,
  AgentFinish,
  AgentStep,
  StoppingMethod,
  Tool,
} from "./index";
import { BaseLLM } from "../llms";
import { LLMChain } from "../chains/llm_chain";
import { BasePromptTemplate } from "../prompt";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createPrompt(tools: Tool[], fields?: Record<string, any>): BasePromptTemplate;
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

export abstract class Agent {
  llmChain: LLMChain;

  allowedTools?: string[] = undefined;

  returnValues = ["output"];

  constructor(input: AgentInput) {
    this.llmChain = input.llmChain;
    this.allowedTools = input.allowedTools;
  }

  abstract extractToolAndInput(
    input: string
  ): { tool: string; input: string } | null;

  abstract observationPrefix(): string;

  abstract llmPrefix(): string;

  abstract _agentType(): string;

  prepareForNewCall(): void {}

  // eslint-disable-next-line no-unused-vars
  static validateTools(_: Tool[]): void {}

  _stop(): string[] {
    return [`\n${this.observationPrefix()}`];
  }

  finishToolName(): string {
    return "Final Answer";
  }

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

  plan(
    steps: AgentStep[],
    inputs: ChainValues
  ): Promise<AgentAction | AgentFinish> {
    return this._plan(steps, inputs);
  }

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
