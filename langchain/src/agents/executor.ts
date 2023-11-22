import { BaseChain, ChainInputs } from "../chains/base.js";
import {
  BaseMultiActionAgent,
  BaseSingleActionAgent,
  RunnableAgent,
} from "./agent.js";
import { StoppingMethod } from "./types.js";
import { SerializedLLMChain } from "../chains/serde.js";
import {
  AgentAction,
  AgentFinish,
  AgentStep,
  ChainValues,
} from "../schema/index.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";
import { OutputParserException } from "../schema/output_parser.js";
import {
  StructuredTool,
  Tool,
  ToolInputParsingException,
} from "../tools/base.js";
import { Runnable } from "../schema/runnable/base.js";
import { RunnableConfig } from "../schema/runnable/config.js";
import { AgentExecutorIterator } from "./agent_iterator.js";

type ExtractToolType<T> = T extends { ToolType: infer Tool }
  ? Tool
  : StructuredTool;

/**
 * Interface defining the structure of input data for creating an
 * AgentExecutor. It extends ChainInputs and includes additional
 * properties specific to agent execution.
 */
export interface AgentExecutorInput extends ChainInputs {
  agent:
    | BaseSingleActionAgent
    | BaseMultiActionAgent
    | Runnable<
        ChainValues & { steps?: AgentStep[] },
        AgentAction[] | AgentAction | AgentFinish
      >;
  tools: ExtractToolType<this["agent"]>[];
  returnIntermediateSteps?: boolean;
  maxIterations?: number;
  earlyStoppingMethod?: StoppingMethod;
  handleParsingErrors?:
    | boolean
    | string
    | ((e: OutputParserException | ToolInputParsingException) => string);
}

// TODO: Type properly with { intermediateSteps?: AgentStep[] };
export type AgentExecutorOutput = ChainValues;

/**
 * Tool that just returns the query.
 * Used for exception tracking.
 */
export class ExceptionTool extends Tool {
  name = "_Exception";

  description = "Exception tool";

  async _call(query: string) {
    return query;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class AddableMap extends Map<string, any> {
  merge(other: AddableMap): AddableMap {
    const result = new AddableMap(this);
    for (const [key, value] of other) {
      if (!result.has(key) || result.get(key) === null) {
        result.set(key, value);
      } else if (value !== null) {
        result.set(key, result.get(key) + value);
      }
    }
    return result;
  }
}

class AgentStreamOutput extends AddableMap {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(key: string): any {
    if (key === "intermediateSteps") {
      const actions = this.get("actions") || [];
      const observations = this.get("observations") || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return actions.map((action: any, index: number) => [
        action,
        observations[index],
      ]);
    } else {
      return super.get(key);
    }
  }
}

/**
 * A chain managing an agent using tools.
 * @augments BaseChain
 * @example
 * ```typescript
 *
 * const executor = AgentExecutor.fromAgentAndTools({
 *   agent: async () => loadAgentFromLangchainHub(),
 *   tools: [new SerpAPI(), new Calculator()],
 *   returnIntermediateSteps: true,
 * });
 *
 * const result = await executor.invoke({
 *   input: `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`,
 * });
 *
 * ```
 */
export class AgentExecutor extends BaseChain<ChainValues, AgentExecutorOutput> {
  static lc_name() {
    return "AgentExecutor";
  }

  get lc_namespace() {
    return ["langchain", "agents", "executor"];
  }

  agent: BaseSingleActionAgent | BaseMultiActionAgent;

  tools: this["agent"]["ToolType"][];

  returnIntermediateSteps = false;

  maxIterations?: number = 15;

  earlyStoppingMethod: StoppingMethod = "force";

  /**
   * How to handle errors raised by the agent's output parser.
    Defaults to `False`, which raises the error.

    If `true`, the error will be sent back to the LLM as an observation.
    If a string, the string itself will be sent to the LLM as an observation.
    If a callable function, the function will be called with the exception
    as an argument, and the result of that function will be passed to the agent
    as an observation.
   */
  handleParsingErrors:
    | boolean
    | string
    | ((e: OutputParserException | ToolInputParsingException) => string) =
    false;

  get inputKeys() {
    return this.agent.inputKeys;
  }

  get outputKeys() {
    return this.agent.returnValues;
  }

  constructor(input: AgentExecutorInput) {
    let agent: BaseSingleActionAgent | BaseMultiActionAgent;
    if (Runnable.isRunnable(input.agent)) {
      agent = new RunnableAgent({ runnable: input.agent });
    } else {
      agent = input.agent;
    }

    super(input);
    this.agent = agent;
    this.tools = input.tools;
    this.handleParsingErrors =
      input.handleParsingErrors ?? this.handleParsingErrors;
    if (this.agent._agentActionType() === "multi") {
      for (const tool of this.tools) {
        if (tool.returnDirect) {
          throw new Error(
            `Tool with return direct ${tool.name} not supported for multi-action agent.`
          );
        }
      }
    }
    this.returnIntermediateSteps =
      input.returnIntermediateSteps ?? this.returnIntermediateSteps;
    this.maxIterations = input.maxIterations ?? this.maxIterations;
    this.earlyStoppingMethod =
      input.earlyStoppingMethod ?? this.earlyStoppingMethod;
  }

  /** Create from agent and a list of tools. */
  static fromAgentAndTools(fields: AgentExecutorInput): AgentExecutor {
    return new AgentExecutor(fields);
  }

  get shouldContinueGetter() {
    return this.shouldContinue.bind(this);
  }

  /**
   * Method that checks if the agent execution should continue based on the
   * number of iterations.
   * @param iterations The current number of iterations.
   * @returns A boolean indicating whether the agent execution should continue.
   */
  private shouldContinue(iterations: number): boolean {
    return this.maxIterations === undefined || iterations < this.maxIterations;
  }

  /** @ignore */
  async _call(
    inputs: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<AgentExecutorOutput> {
    const toolsByName = Object.fromEntries(
      this.tools.map((t) => [t.name.toLowerCase(), t])
    );
    const steps: AgentStep[] = [];
    let iterations = 0;

    const getOutput = async (
      finishStep: AgentFinish
    ): Promise<AgentExecutorOutput> => {
      const { returnValues } = finishStep;
      const additional = await this.agent.prepareForOutput(returnValues, steps);

      if (this.returnIntermediateSteps) {
        return { ...returnValues, intermediateSteps: steps, ...additional };
      }
      await runManager?.handleAgentEnd(finishStep);
      return { ...returnValues, ...additional };
    };

    while (this.shouldContinue(iterations)) {
      let output;
      try {
        output = await this.agent.plan(steps, inputs, runManager?.getChild());
      } catch (e) {
        // eslint-disable-next-line no-instanceof/no-instanceof
        if (e instanceof OutputParserException) {
          let observation;
          let text = e.message;
          if (this.handleParsingErrors === true) {
            if (e.sendToLLM) {
              observation = e.observation;
              text = e.llmOutput ?? "";
            } else {
              observation = "Invalid or incomplete response";
            }
          } else if (typeof this.handleParsingErrors === "string") {
            observation = this.handleParsingErrors;
          } else if (typeof this.handleParsingErrors === "function") {
            observation = this.handleParsingErrors(e);
          } else {
            throw e;
          }
          output = {
            tool: "_Exception",
            toolInput: observation,
            log: text,
          } as AgentAction;
        } else {
          throw e;
        }
      }
      // Check if the agent has finished
      if ("returnValues" in output) {
        return getOutput(output);
      }

      let actions: AgentAction[];
      if (Array.isArray(output)) {
        actions = output as AgentAction[];
      } else {
        actions = [output as AgentAction];
      }

      const newSteps = await Promise.all(
        actions.map(async (action) => {
          await runManager?.handleAgentAction(action);
          const tool =
            action.tool === "_Exception"
              ? new ExceptionTool()
              : toolsByName[action.tool?.toLowerCase()];
          let observation;
          try {
            observation = tool
              ? await tool.call(action.toolInput, runManager?.getChild())
              : `${action.tool} is not a valid tool, try another one.`;
          } catch (e) {
            // eslint-disable-next-line no-instanceof/no-instanceof
            if (e instanceof ToolInputParsingException) {
              if (this.handleParsingErrors === true) {
                observation =
                  "Invalid or incomplete tool input. Please try again.";
              } else if (typeof this.handleParsingErrors === "string") {
                observation = this.handleParsingErrors;
              } else if (typeof this.handleParsingErrors === "function") {
                observation = this.handleParsingErrors(e);
              } else {
                throw e;
              }
              observation = await new ExceptionTool().call(
                observation,
                runManager?.getChild()
              );
              return { action, observation: observation ?? "" };
            }
          }

          return { action, observation: observation ?? "" };
        })
      );

      steps.push(...newSteps);

      const lastStep = steps[steps.length - 1];
      const lastTool = toolsByName[lastStep.action.tool?.toLowerCase()];

      if (lastTool?.returnDirect) {
        return getOutput({
          returnValues: { [this.agent.returnValues[0]]: lastStep.observation },
          log: "",
        });
      }

      iterations += 1;
    }

    const finish = await this.agent.returnStoppedResponse(
      this.earlyStoppingMethod,
      steps,
      inputs
    );

    return getOutput(finish);
  }

  async _takeNextStep(
    nameToolMap: Record<string, Tool>,
    inputs: ChainValues,
    intermediateSteps: AgentStep[],
    runManager?: CallbackManagerForChainRun
  ): Promise<AgentFinish | AgentStep[]> {
    let output;
    try {
      output = await this.agent.plan(
        intermediateSteps,
        inputs,
        runManager?.getChild()
      );
    } catch (e) {
      // handle rrr
    }

    if (output && "returnValues" in output) {
      return output;
    }

    let actions: AgentAction[];
    if (Array.isArray(output)) {
      actions = output as AgentAction[];
    } else {
      actions = [output as AgentAction];
    }

    const result: AgentStep[] = [];
    for (const agentAction of actions) {
      let observation = "";
      if (runManager) {
        await runManager?.handleAgentAction(agentAction);
      }
      if (agentAction.tool in nameToolMap) {
        const tool = nameToolMap[agentAction.tool];
        try {
          observation = await tool.call(
            agentAction.toolInput,
            runManager?.getChild()
          );
        } catch (e) {
          // handle rrr
        }
        intermediateSteps.push({
          action: agentAction,
          observation: observation ?? "",
        });
      } else {
        observation = `${
          agentAction.tool
        } is not a valid tool, try another available tool: ${Object.keys(
          nameToolMap
        ).join(", ")}`;
      }
      result.push({
        action: agentAction,
        observation: observation ?? "",
      });
    }
    return result;
  }

  async _return(
    output: AgentFinish,
    intermediateSteps: AgentStep[],
    runManager?: CallbackManagerForChainRun
  ): Promise<AgentExecutorOutput> {
    if (runManager) {
      await runManager.handleAgentEnd(output);
    }
    const finalOutput: Record<string, unknown> = output.returnValues;
    if (this.returnIntermediateSteps) {
      finalOutput.intermediateSteps = intermediateSteps;
    }
    return finalOutput;
  }

  async _getToolReturn(nextStepOutput: AgentStep): Promise<AgentFinish | null> {
    const { action, observation } = nextStepOutput;
    const nameToolMap = Object.fromEntries(
      this.tools.map((t) => [t.name.toLowerCase(), t])
    );
    const [returnValueKey = "output"] = this.agent.returnValues;
    // Invalid tools won't be in the map, so we return False.
    if (action.tool in nameToolMap) {
      if (nameToolMap[action.tool].returnDirect) {
        return {
          returnValues: { [returnValueKey]: observation },
          log: "",
        };
      }
    }
    return null;
  }

  _returnStoppedResponse(earlyStoppingMethod: StoppingMethod) {
    if (earlyStoppingMethod === "force") {
      return {
        returnValues: {
          output: "Agent stopped due to iteration limit or time limit.",
        },
        log: "",
      } as AgentFinish;
    }
    throw new Error(
      `Got unsupported early_stopping_method: ${earlyStoppingMethod}`
    );
  }

  async *_streamIterator(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputs: Record<string, any>,
    /** @TODO Figure out where to use this. */
    _config: RunnableConfig | null = null
  ): AsyncGenerator<AgentStreamOutput> {
    const iterator = new AgentExecutorIterator({
      inputs,
      agentExecutor: this,
      metadata: this.metadata,
      tags: this.tags,
      callbacks: this.callbacks,
    });
    for await (const step of iterator) {
      if (!step) {
        continue;
      }
      if ("intermediateSteps" in step) {
        const castStep = step as Record<string, AgentStep[]>;
        yield new AgentStreamOutput(
          Object.entries({
            actions: castStep.intermediateSteps.map(({ action }) => action),
            observations: castStep.intermediateSteps.map(
              ({ observation }) => observation
            ),
          })
        );
      } else {
        yield new AgentStreamOutput(Object.entries(step));
      }
    }
  }

  _chainType() {
    return "agent_executor" as const;
  }

  serialize(): SerializedLLMChain {
    throw new Error("Cannot serialize an AgentExecutor");
  }
}
