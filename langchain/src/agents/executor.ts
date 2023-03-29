import { BaseChain } from "../chains/index.js";
import { Agent } from "./agent.js";
import { Tool } from "./tools/base.js";
import { StoppingMethod } from "./types.js";
import { SerializedLLMChain } from "../chains/serde.js";
import { AgentFinish, AgentStep, ChainValues } from "../schema/index.js";
import { CallbackManager } from "../callbacks/index.js";

type AgentExecutorInput = {
  agent: Agent;
  tools: Tool[];
  returnIntermediateSteps?: boolean;
  maxIterations?: number;
  earlyStoppingMethod?: StoppingMethod;

  verbose?: boolean;
  callbackManager?: CallbackManager;
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

  earlyStoppingMethod: StoppingMethod = "force";

  get inputKeys() {
    return this.agent.inputKeys;
  }

  constructor(input: AgentExecutorInput) {
    super();
    this.agent = input.agent;
    this.tools = input.tools;
    this.returnIntermediateSteps =
      input.returnIntermediateSteps ?? this.returnIntermediateSteps;
    this.maxIterations = input.maxIterations ?? this.maxIterations;
    this.earlyStoppingMethod =
      input.earlyStoppingMethod ?? this.earlyStoppingMethod;
    this.verbose = input.verbose ?? this.verbose;
    this.callbackManager = input.callbackManager ?? this.callbackManager;
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

  async _call(
    inputs: ChainValues,
    callbackManager?: CallbackManager,
    runId?: string
  ): Promise<ChainValues> {
    this.agent.prepareForNewCall();
    const toolsByName = Object.fromEntries(
      this.tools.map((t) => [t.name.toLowerCase(), t])
    );
    const steps: AgentStep[] = [];
    let iterations = 0;

    const getOutput = async (finishStep: AgentFinish) => {
      const { returnValues } = finishStep;
      const additional = await this.agent.prepareForOutput(returnValues, steps);

      if (this.returnIntermediateSteps) {
        return { ...returnValues, intermediateSteps: steps, ...additional };
      }
      await this.callbackManager.handleAgentEnd(
        finishStep,
        runId ?? "",
        this.verbose
      );
      return { ...returnValues, ...additional };
    };

    while (this.shouldContinue(iterations)) {
      const action = await this.agent.plan(steps, inputs, callbackManager?.getChild());
      if ("returnValues" in action) {
        return getOutput(action);
      }
      await this.callbackManager.handleAgentAction(
        action,
        runId ?? "",
        this.verbose
      );

      const tool = toolsByName[action.tool.toLowerCase()];
      const observation = tool
        ? await tool.call(action.toolInput, this.verbose, callbackManager?.getChild())
        : `${action.tool} is not a valid tool, try another one.`;
      steps.push({ action, observation });
      if (tool?.returnDirect) {
        return getOutput({
          returnValues: { [this.agent.returnValues[0]]: observation },
          log: "",
        });
      }
      iterations += 1;
    }

    const finish = await this.agent.returnStoppedResponse(
      this.earlyStoppingMethod,
      steps,
      inputs,
      callbackManager
    );

    return getOutput(finish);
  }

  _chainType() {
    return "agent_executor" as const;
  }

  serialize(): SerializedLLMChain {
    throw new Error("Cannot serialize an AgentExecutor");
  }
}
