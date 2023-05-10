import { BaseOutputParser } from "../../schema/output_parser.js";
import { BaseChain } from "../../chains/base.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { ChainValues } from "../../schema/index.js";
import { CallbackManager } from "../../callbacks/manager.js";

export type StepAction = {
  text: string;
};

export type StepResult = {
  response: string;
};

export type Step = {
  action: StepAction;
  result: StepResult;
};

export type Plan = {
  steps: StepAction[];
};

export abstract class BasePlanner {
  abstract plan(
    inputs: ChainValues,
    runManager?: CallbackManager
  ): Promise<Plan>;
}

export abstract class BaseStepExecutor {
  abstract step(
    inputs: ChainValues,
    runManager?: CallbackManager
  ): Promise<StepResult>;
}

export abstract class BaseStepContainer {
  abstract addStep(action: StepAction, result: StepResult): void;

  abstract getSteps(): Step[];

  abstract getFinalResponse(): string;
}

export class ListStepContainer extends BaseStepContainer {
  private steps: Step[] = [];

  addStep(action: StepAction, result: StepResult) {
    this.steps.push({ action, result });
  }

  getSteps() {
    return this.steps;
  }

  getFinalResponse(): string {
    return this.steps[this.steps.length - 1]?.result?.response;
  }
}

export class LLMPlanner extends BasePlanner {
  constructor(
    private llmChain: LLMChain,
    private outputParser: BaseOutputParser<Plan>
  ) {
    super();
  }

  async plan(inputs: ChainValues, runManager?: CallbackManager): Promise<Plan> {
    const output = await this.llmChain.run(inputs, runManager);
    return this.outputParser.parse(output);
  }
}

export class ChainStepExecutor extends BaseStepExecutor {
  constructor(private chain: BaseChain) {
    super();
  }

  async step(
    inputs: ChainValues,
    runManager?: CallbackManager
  ): Promise<StepResult> {
    const chainResponse = await this.chain.call(inputs, runManager);
    return { response: chainResponse.output };
  }
}
