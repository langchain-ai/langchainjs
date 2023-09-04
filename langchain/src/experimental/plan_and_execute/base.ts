import { BaseOutputParser } from "../../schema/output_parser.js";
import { BaseChain } from "../../chains/base.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { ChainValues } from "../../schema/index.js";
import { CallbackManager } from "../../callbacks/manager.js";

/**
 * Represents an action to be performed in a step.
 */
export type StepAction = {
  text: string;
};

/**
 * Represents the result of a step.
 */
export type StepResult = {
  response: string;
};

/**
 * Represents a step, which includes an action and its result.
 */
export type Step = {
  action: StepAction;
  result: StepResult;
};

/**
 * Represents a plan, which is a sequence of step actions.
 */
export type Plan = {
  steps: StepAction[];
};

/**
 * Abstract class that defines the structure for a planner. Planners are
 * responsible for generating a plan based on inputs.
 */
export abstract class BasePlanner {
  abstract plan(
    inputs: ChainValues,
    runManager?: CallbackManager
  ): Promise<Plan>;
}

/**
 * Abstract class that defines the structure for a step executor. Step
 * executors are responsible for executing a step based on inputs.
 */
export abstract class BaseStepExecutor {
  abstract step(
    inputs: ChainValues,
    runManager?: CallbackManager
  ): Promise<StepResult>;
}

/**
 * Abstract class that defines the structure for a step container. Step
 * containers are responsible for managing steps.
 */
export abstract class BaseStepContainer {
  abstract addStep(action: StepAction, result: StepResult): void;

  abstract getSteps(): Step[];

  abstract getFinalResponse(): string;
}

/**
 * Class that extends BaseStepContainer and provides an implementation for
 * its methods. It maintains a list of steps and provides methods to add a
 * step, get all steps, and get the final response.
 */
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

/**
 * Class that extends BasePlanner and provides an implementation for the
 * plan method. It uses an instance of LLMChain and an output parser to
 * generate a plan.
 */
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

/**
 * Class that extends BaseStepExecutor and provides an implementation for
 * the step method. It uses an instance of BaseChain to execute a step.
 */
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
