import { BaseMemory } from "../../memory.js";
import { ChainValues } from "../../utils/types/index.js";
import { RUN_KEY } from "../../outputs.js";
import {
  CallbackManagerForChainRun,
  CallbackManager,
  Callbacks,
  parseCallbackConfigArg,
} from "../../callbacks/manager.js";
import { ensureConfig, type RunnableConfig } from "../../runnables/index.js";
import {
  BaseLangChain,
  BaseLangChainParams,
} from "../../language_models/base.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

export interface ChainInputs extends BaseLangChainParams {
  memory?: BaseMemory;

  /**
   * @deprecated Use `callbacks` instead
   */
  callbackManager?: CallbackManager;
}

/**
 * Base interface that all chains must implement.
 */
export abstract class BaseChain<
    RunInput extends ChainValues = ChainValues,
    RunOutput extends ChainValues = ChainValues
  >
  extends BaseLangChain<RunInput, RunOutput>
  implements ChainInputs
{
  declare memory?: BaseMemory;

  get lc_namespace(): string[] {
    return ["langchain", "chains", this._chainType()];
  }

  constructor(
    fields?: BaseMemory | ChainInputs,
    /** @deprecated */
    verbose?: boolean,
    /** @deprecated */
    callbacks?: Callbacks
  ) {
    if (
      arguments.length === 1 &&
      typeof fields === "object" &&
      !("saveContext" in fields)
    ) {
      // fields is not a BaseMemory
      const { memory, callbackManager, ...rest } = fields;
      super({ ...rest, callbacks: callbackManager ?? rest.callbacks });
      this.memory = memory;
    } else {
      // fields is a BaseMemory
      super({ verbose, callbacks });
      this.memory = fields as BaseMemory;
    }
  }

  /** @ignore */
  _selectMemoryInputs(values: ChainValues): ChainValues {
    const valuesForMemory = { ...values };
    if ("signal" in valuesForMemory) {
      delete valuesForMemory.signal;
    }
    if ("timeout" in valuesForMemory) {
      delete valuesForMemory.timeout;
    }
    return valuesForMemory;
  }

  /**
   * Invoke the chain with the provided input and returns the output.
   * @param input Input values for the chain run.
   * @param config Optional configuration for the Runnable.
   * @returns Promise that resolves with the output of the chain run.
   */
  async invoke(input: RunInput, options?: RunnableConfig): Promise<RunOutput> {
    const config = ensureConfig(options);
    const fullValues = await this._formatValues(input);
    const callbackManager_ = await CallbackManager.configure(
      config?.callbacks,
      this.callbacks,
      config?.tags,
      this.tags,
      config?.metadata,
      this.metadata,
      { verbose: this.verbose }
    );
    const runManager = await callbackManager_?.handleChainStart(
      this.toJSON(),
      fullValues,
      undefined,
      undefined,
      undefined,
      undefined,
      config?.runName
    );
    let outputValues: RunOutput;
    try {
      outputValues = await (fullValues.signal
        ? (Promise.race([
            this._call(fullValues as RunInput, runManager, config),
            new Promise((_, reject) => {
              fullValues.signal?.addEventListener("abort", () => {
                reject(new Error("AbortError"));
              });
            }),
          ]) as Promise<RunOutput>)
        : this._call(fullValues as RunInput, runManager, config));
    } catch (e) {
      await runManager?.handleChainError(e);
      throw e;
    }
    if (!(this.memory == null)) {
      await this.memory.saveContext(
        this._selectMemoryInputs(input),
        outputValues
      );
    }
    await runManager?.handleChainEnd(outputValues);
    // add the runManager's currentRunId to the outputValues
    Object.defineProperty(outputValues, RUN_KEY, {
      value: runManager ? { runId: runManager?.runId } : undefined,
      configurable: true,
    });
    return outputValues;
  }

  private _validateOutputs(outputs: Record<string, unknown>): void {
    const missingKeys = this.outputKeys.filter((k) => !(k in outputs));
    if (missingKeys.length) {
      throw new Error(
        `Missing output keys: ${missingKeys.join(
          ", "
        )} from chain ${this._chainType()}`
      );
    }
  }

  async prepOutputs(
    inputs: Record<string, unknown>,
    outputs: Record<string, unknown>,
    returnOnlyOutputs = false
  ) {
    this._validateOutputs(outputs);
    if (this.memory) {
      await this.memory.saveContext(inputs, outputs);
    }
    if (returnOnlyOutputs) {
      return outputs;
    }
    return { ...inputs, ...outputs };
  }

  /**
   * Run the core logic of this chain and return the output
   */
  abstract _call(
    values: RunInput,
    runManager?: CallbackManagerForChainRun,
    config?: RunnableConfig
  ): Promise<RunOutput>;

  /**
   * Return the string type key uniquely identifying this class of chain.
   */
  abstract _chainType(): string;

  abstract get inputKeys(): string[];

  abstract get outputKeys(): string[];

  /** @deprecated Use .invoke() instead. Will be removed in 0.2.0. */
  async run(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: any,
    config?: Callbacks | RunnableConfig
  ): Promise<string> {
    const inputKeys = this.inputKeys.filter(
      (k) => !this.memory?.memoryKeys.includes(k) ?? true
    );
    const isKeylessInput = inputKeys.length <= 1;
    if (!isKeylessInput) {
      throw new Error(
        `Chain ${this._chainType()} expects multiple inputs, cannot use 'run' `
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values = inputKeys.length ? { [inputKeys[0]]: input } : ({} as any);
    const returnValues = await this.call(values, config);
    const keys = Object.keys(returnValues);

    if (keys.length === 1) {
      return returnValues[keys[0]];
    }
    throw new Error(
      "return values have multiple keys, `run` only supported when one key currently"
    );
  }

  protected async _formatValues(
    values: ChainValues & { signal?: AbortSignal; timeout?: number }
  ) {
    const fullValues = { ...values } as typeof values;
    if (fullValues.timeout && !fullValues.signal) {
      fullValues.signal = AbortSignal.timeout(fullValues.timeout);
      delete fullValues.timeout;
    }
    if (!(this.memory == null)) {
      const newValues = await this.memory.loadMemoryVariables(
        this._selectMemoryInputs(values)
      );
      for (const [key, value] of Object.entries(newValues)) {
        fullValues[key] = value;
      }
    }
    return fullValues;
  }

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.2.0.
   *
   * Run the core logic of this chain and add to output if desired.
   *
   * Wraps _call and handles memory.
   */
  async call(
    values: ChainValues & { signal?: AbortSignal; timeout?: number },
    config?: Callbacks | RunnableConfig,
    /** @deprecated */
    tags?: string[]
  ): Promise<RunOutput> {
    const parsedConfig = { tags, ...parseCallbackConfigArg(config) };
    return this.invoke(values as RunInput, parsedConfig);
  }

  /**
   * @deprecated Use .batch() instead. Will be removed in 0.2.0.
   *
   * Call the chain on all inputs in the list
   */
  async apply(
    inputs: RunInput[],
    config?: (Callbacks | RunnableConfig)[]
  ): Promise<RunOutput[]> {
    return Promise.all(
      inputs.map(async (i, idx) => this.call(i, config?.[idx]))
    );
  }
}
