import { BaseChain, ChainInputs } from "../../chains/base.js";
import { PlanAndExecuteAgent } from "./index.js";

import {
  ChainValues,
} from "../../schema/index.js";
// import { CallbackManagerForChainRun } from "../callbacks/manager.js";
// import { LLMChain } from "../../chains/llm_chain.js";
// import { BaseOutputParser } from "../../schema/output_parser.js";
import { Tool } from "../../tools/base.js";
import { StoppingMethod } from "../types.js";
import { SerializedLLMChain } from "../../chains/serde.js";


export interface PlanAndExecuteAgentExecutorInput extends ChainInputs {
  agent: PlanAndExecuteAgent;
  tools: Tool[];
  returnIntermediateSteps?: boolean;
  maxIterations?: number;
  earlyStoppingMethod?: StoppingMethod;
}

export class PlanAndExecuteAgentExecutor extends BaseChain {
  public agent: PlanAndExecuteAgent;

  constructor(input: PlanAndExecuteAgentExecutorInput) {
    super(input);
    this.agent = input.agent;
  }

  get inputKeys() {
    return this.agent.inputKeys;
  }

  get outputKeys() {
    return this.agent.returnValues;
  }

  /** @ignore */
  async _call(
    inputs: ChainValues,
    // runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    const plan = await this.agent.createPlan(inputs.input);
    console.log(plan);
    if (!plan.steps?.length) {
      throw new Error("Could not create and parse a plan to answer your question - please try again.");
    }
    const previousSteps = [];
    for (const step of plan.steps) {
      const newInputs = {
        ...inputs,
        previous_steps: JSON.stringify(previousSteps),
        current_step: step.text
      };
      const currentStep = await this.agent.executePlanStep(newInputs);
      previousSteps.push(currentStep);
    }
    return {answer: previousSteps[previousSteps.length - 1].response};
  }

  _chainType() {
    return "agent_executor" as const;
  }

  serialize(): SerializedLLMChain {
    throw new Error("Cannot serialize an AgentExecutor");
  }
}
