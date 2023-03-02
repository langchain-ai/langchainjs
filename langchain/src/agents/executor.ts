import { ChainValues, BaseChain } from "../chains/index.js";
import {
  Agent,
  Tool,
  StoppingMethod,
  AgentStep,
  AgentFinish,
} from "./index.js";
import { SerializedLLMChain } from "../chains/llm_chain.js";

type AgentExecutorInput = {
  agent: Agent;
  tools: Tool[];
  returnIntermediateSteps?: boolean;
  maxIterations?: number;
  earlyStoppingMethod?: StoppingMethod;
};

/**
 * A chain managing an agent using tools.
 * @augments BaseChain
 */
export class AgentExecutor extends BaseChain {
  agent: Agent;

  tools: Tool[];

  returnIntermediateSteps = false;

  maxIterations?: number = 15;

  earlyStoppingMethod: StoppingMethod = 'force';

  private steps: AgentStep[] = [];

  get inputKeys() {
    return this.agent.inputKeys;
  }

  constructor(input: AgentExecutorInput) {
    super();
    this.agent = input.agent;
    this.tools = input.tools;
    this.returnIntermediateSteps = input.returnIntermediateSteps ?? this.returnIntermediateSteps;
    this.maxIterations = input.maxIterations ?? this.maxIterations;
    this.earlyStoppingMethod = input.earlyStoppingMethod ?? this.earlyStoppingMethod;
  }

  /** Create from agent and a list of tools. */
  static fromAgentAndTools(
    fields: {
      agent: Agent;
      tools: Tool[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } & Record<string, any>
  ): AgentExecutor {
    return new AgentExecutor(fields);
  }

  private shouldContinue(iterations: number): boolean {
    return this.maxIterations === undefined || iterations < this.maxIterations;
  }

  async _call(inputs: ChainValues): Promise<ChainValues> {
    this.agent.prepareForNewCall();
    const toolsByName = Object.fromEntries(this.tools.map(t => [t.name.toLowerCase(), t]));

    while (this.shouldContinue(this.steps.length)) {
      const action = await this.agent.plan(this.steps, inputs);
      if ('returnValues' in action) {
        return this.getOutput(action);
      }

      const tool = toolsByName[action.tool.toLowerCase()];
      const observation = tool
        ? await tool.call(action.toolInput)
        : `${action.tool} is not a valid tool, try another one.`;
      this.steps.push({ action, observation });
      if (tool?.returnDirect) {
        return this.getOutput({
          returnValues: { [this.agent.returnValues[0]]: observation },
          log: '',
        });
      }
    }

    const finish = await this.agent.returnStoppedResponse(this.earlyStoppingMethod, this.steps, inputs);

    return this.getOutput(finish);
  }

  _chainType() {
    return 'agent_executor' as const;
  }

  serialize(): SerializedLLMChain {
    throw new Error('Cannot serialize an AgentExecutor');
  }

  serializeSteps(): string {
    return JSON.stringify(this.steps);
  }

  /**
   * Deserialize steps from a string.
   * @param serializedSteps - The serialized steps.
   * @param lastReturnValue - If set, replaces the return value from the last executed step.
   */
  deserializeSteps(serializedSteps: string, lastReturnValue?: string): void {
    this.steps = JSON.parse(serializedSteps);

    if (lastReturnValue) {
      this.steps[this.steps.length - 1].observation = lastReturnValue;
    }
  }

  private getOutput(finishStep: AgentFinish) {
    const { returnValues } = finishStep;
    if (this.returnIntermediateSteps) {
      return { ...returnValues, intermediateSteps: this.steps };
    }
    return returnValues;
  }
}
