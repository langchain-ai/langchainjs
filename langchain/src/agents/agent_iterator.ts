import {
  CallbackManager,
  CallbackManagerForChainRun,
  Callbacks,
} from "../callbacks/manager.js";
import { Serializable } from "../load/serializable.js";
import { AgentFinish, AgentStep } from "../schema/index.js";
import { Tool } from "../tools/base.js";
import { AgentExecutor } from "./executor.js";

interface AgentExecutorIteratorInput {
  agentExecutor: AgentExecutor;
  inputs: Record<string, string>;
  callbacks?: Callbacks;
  tags?: string[];
  metadata?: Record<string, unknown>;
  runName?: string;
  runManager?: CallbackManagerForChainRun;
}

export class AgentExecutorIterator
  extends Serializable
  implements AgentExecutorIteratorInput
{
  lc_namespace = ["langchain", "agents", "executor", "iterator"];

  agentExecutor: AgentExecutor;

  inputs: Record<string, string>;

  callbacks: Callbacks;

  tags: string[] | undefined;

  metadata: Record<string, unknown> | undefined;

  runName: string | undefined;

  private _finalOutputs: Record<string, unknown> | undefined;

  get finalOutputs(): Record<string, unknown> | undefined {
    return this._finalOutputs;
  }

  /** Intended to be used as a setter method, needs to be async. */
  async setFinalOutputs(value: Record<string, unknown> | undefined) {
    this._finalOutputs = undefined;
    if (value) {
      const preparedOutputs: Record<string, unknown> =
        await this.agentExecutor.prepOutputs(this.inputs, value, true);
      this._finalOutputs = preparedOutputs;
    }
  }

  runManager: CallbackManagerForChainRun | undefined;

  intermediateSteps: AgentStep[] = [];

  iterations = 0;

  get nameToToolMap(): Record<string, Tool> {
    const toolMap = this.agentExecutor.tools.map((tool) => ({ [tool.name]: tool }));
    return Object.assign({}, ...toolMap);
  }

  constructor(fields: AgentExecutorIteratorInput) {
    super();
    this.agentExecutor = fields.agentExecutor;
    this.inputs = fields.inputs;
    this.tags = fields.tags;
    this.metadata = fields.metadata;
    this.runName = fields.runName;
    this.runManager = fields.runManager;
  }

  /**
   * Reset the iterator to its initial state, clearing intermediate steps,
   * iterations, and time elapsed.
   */
  reset(): void {
    this.intermediateSteps = [];
    this.iterations = 0;
    this._finalOutputs = undefined;
  }

  /**
   * Increment the number of iterations and update the time elapsed.
   */
  updateIterations(): void {
    this.iterations += 1;
  }

  /** Method to initialize the iterator */
  async *[Symbol.asyncIterator]() {
    this.reset();

    // Loop to handle iteration
    while (true) {
      try {
        if (this.iterations === 0) {
          await this.onFirstStep();
        }

        const result = await this._callNext();
        yield result;
      } catch (e: any) {
        if (
          "message" in e &&
          e.message.startsWith("Final outputs already reached: ")
        ) {
          if (!this.finalOutputs) {
            throw e;
          }
          return this.finalOutputs;
        }
        if (this.runManager) {
          await this.runManager.handleChainError(e);
        }
        throw e;
      }
    }
  }

  /** Perform any necessary setup for the first step of the asynchronous iterator. */
  async onFirstStep(): Promise<void> {
    if (this.iterations === 0) {
      const callbackManager = await CallbackManager.configure(
        this.callbacks,
        this.agentExecutor.callbacks,
        this.tags,
        this.agentExecutor.tags,
        this.metadata,
        this.agentExecutor.metadata,
        {
          verbose: this.agentExecutor.verbose,
        }
      );
      this.runManager = await callbackManager?.handleChainStart(
        this.agentExecutor.toJSON(),
        this.inputs,
        undefined,
        undefined,
        this.tags,
        this.metadata,
        this.runName
      );
    }
  }

  /** Not used, tbd */
  // async next(): Promise<Record<string, unknown>> {
  //   if (this.iterations === 0) {
  //     await this.onFirstStep();
  //   }
  //   try {
  //     return this._callNext();
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   } catch (e: any) {
  //     if (
  //       "message" in e &&
  //       e.message.startsWith("Final outputs already reached: ")
  //     ) {
  //       if (!this.finalOutputs) {
  //         throw e;
  //       }
  //       return this.finalOutputs;
  //     }
  //     if (this.runManager) {
  //       await this.runManager.handleChainError(e);
  //     }
  //     throw e;
  //   }
  // }

  /**
   * Execute the next step in the chain using the
   * AgentExecutor's _takeNextStep method.
   */
  async _executeNextStep(
    runManager?: CallbackManagerForChainRun
  ): Promise<AgentFinish | AgentStep[]> {
    return this.agentExecutor._takeNextStep(
      this.nameToToolMap,
      this.inputs,
      this.intermediateSteps,
      runManager
    );
  }

  /**
   * Process the output of the next step,
   * handling AgentFinish and tool return cases.
   */
  async _processNextStepOutput(
    nextStepOutput: AgentFinish | AgentStep[],
    runManager?: CallbackManagerForChainRun
  ): Promise<Record<string, string | AgentStep[]>> {
    if ("returnValues" in nextStepOutput) {
      const output = await this.agentExecutor._return(
        nextStepOutput as AgentFinish,
        this.intermediateSteps,
        runManager
      );
      if (this.runManager) {
        await this.runManager.handleChainEnd(output);
      }
      await this.setFinalOutputs(output);
      return output;
    }

    this.intermediateSteps = this.intermediateSteps.concat(
      nextStepOutput as AgentStep[]
    );

    let output: Record<string, string | AgentStep[]> = {};
    if (Array.isArray(nextStepOutput) && nextStepOutput.length === 1) {
      const nextStep = nextStepOutput[0];
      const toolReturn = await this.agentExecutor._getToolReturn(nextStep);
      if (toolReturn) {
        output = await this.agentExecutor._return(
          toolReturn,
          this.intermediateSteps,
          runManager
        );
        if (this.runManager) {
          await this.runManager.handleChainEnd(output);
        }
        await this.setFinalOutputs(output);
      }
    }
    output = { intermediateSteps: nextStepOutput as AgentStep[] };
    return output;
  }

  async _stop(): Promise<Record<string, unknown>> {
    const output = await this.agentExecutor.agent.returnStoppedResponse(
      this.agentExecutor.earlyStoppingMethod,
      this.intermediateSteps,
      this.inputs
    );
    const returnedOutput = await this.agentExecutor._return(
      output,
      this.intermediateSteps,
      this.runManager
    );
    await this.setFinalOutputs(returnedOutput);
    return returnedOutput;
  }

  async _callNext(): Promise<Record<string, unknown>> {
    // final output already reached: stopiteration (final output)
    if (this.finalOutputs) {
      throw new Error(
        `Final outputs already reached: ${JSON.stringify(
          this.finalOutputs,
          null,
          2
        )}`
      );
    }
    // timeout/max iterations: stopiteration (stopped response)
    if (!this.agentExecutor.shouldContinueGetter(this.iterations)) {
      return this._stop();
    }
    const nextStepOutput = await this._executeNextStep(this.runManager);
    const output = await this._processNextStepOutput(
      nextStepOutput,
      this.runManager
    );
    this.updateIterations();
    return output;
  }
}
