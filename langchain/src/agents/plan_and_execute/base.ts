import { BaseOutputParser } from "../../schema/output_parser.js";
// import { CallbackManager, Callbacks } from "../../callbacks/manager.js";
import { BaseChain } from "../../chains/base.js";
import { LLMChain } from "../../chains/llm_chain.js";
import {
  ChainValues,
} from "../../schema/index.js";
import { BaseAgent } from "../agent.js";

export type PlanStep = {
  text: string;
  response?: string;
}

export type Plan = {
  steps: PlanStep[];
}

export abstract class BasePlanner {
  abstract plan(inputs: ChainValues): Promise<Plan>;
  abstract get inputKeys(): string[];
}

export abstract class BaseStepExecutor {
  abstract step(inputs: ChainValues): Promise<string>;
}

export class LLMChainPlanner extends BasePlanner {
  constructor(private llmChain: LLMChain, private outputParser: BaseOutputParser<Plan>) {
    super();
  }
  get inputKeys(): string[] {
    return this.llmChain.inputKeys;
  }
  async plan(inputs: ChainValues): Promise<Plan> {
    const output = await this.llmChain.run(inputs);
    return this.outputParser.parse(output);
  }
}

export class ChainStepExecutor extends BaseStepExecutor {
  constructor(private chain: BaseChain) {
    super();
  }
  async step(inputs: ChainValues): Promise<string> {
    const chainResponse = await this.chain.call(inputs);
    console.log("step run", inputs, chainResponse);
    return chainResponse.output;
  }
}

export interface BasePlanAndExecuteAgentInput {
  planner: BasePlanner;
  stepExecutor: BaseStepExecutor;
}

export abstract class BasePlanAndExecuteAgent extends BaseAgent {
  private planner: BasePlanner;
  private stepExecutor: BaseStepExecutor;

  constructor(input: BasePlanAndExecuteAgentInput) {
    super();
    this.planner = input.planner;
    this.stepExecutor = input.stepExecutor;
  }

  _agentActionType(): string {
    return "single" as const;
  }

  get inputKeys(): string[] {
    return this.planner.inputKeys;
  }

  async createPlan(inputs: ChainValues): Promise<Plan> {
    return this.planner.plan(inputs);
  }

  async executePlanStep(inputs: ChainValues): Promise<PlanStep> {
    return {
      text: inputs.current_step,
      response: await this.stepExecutor.step(inputs)
    };
  }
}
