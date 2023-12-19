import { BaseMemory } from "../memory/base.js";
import { ChainValues, RUN_KEY } from "../schema/index.js";
import {
  CallbackManagerForChainRun,
  CallbackManager,
  Callbacks,
  parseCallbackConfigArg,
} from "../callbacks/manager.js";
import { SerializedBaseChain } from "./serde.js";
import { BaseLangChain, BaseLangChainParams } from "../base_language/index.js";
import { RunnableConfig } from "../schema/runnable/config.js";

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
  async invoke(input: RunInput, config?: RunnableConfig): Promise<RunOutput> {
    return this.call(input, config);
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
    runManager?: CallbackManagerForChainRun
  ): Promise<RunOutput>;

  /**
   * Return the string type key uniquely identifying this class of chain.
   */
  abstract _chainType(): string;

  /**
   * Return a json-like object representing this chain.
   */
  serialize(): SerializedBaseChain {
    throw new Error("Method not implemented.");
  }

  abstract get inputKeys(): string[];

  abstract get outputKeys(): string[];

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
    const fullValues = await this._formatValues(values);
    const parsedConfig = parseCallbackConfigArg(config);
    const callbackManager_ = await CallbackManager.configure(
      parsedConfig.callbacks,
      this.callbacks,
      parsedConfig.tags || tags,
      this.tags,
      parsedConfig.metadata,
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
      parsedConfig.runName
    );
    let outputValues: RunOutput;
    try {
      outputValues = await (values.signal
        ? (Promise.race([
            this._call(fullValues as RunInput, runManager),
            new Promise((_, reject) => {
              values.signal?.addEventListener("abort", () => {
                reject(new Error("AbortError"));
              });
            }),
          ]) as Promise<RunOutput>)
        : this._call(fullValues as RunInput, runManager));
    } catch (e) {
      await runManager?.handleChainError(e);
      throw e;
    }
    if (!(this.memory == null)) {
      await this.memory.saveContext(
        this._selectMemoryInputs(values),
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

  /**
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

  /**
   * Load a chain from a json-like object describing it.
   */
  static async deserialize(
    data: SerializedBaseChain,
    values: LoadValues = {}
  ): Promise<BaseChain> {
    switch (data._type) {
      case "llm_chain": {
        const { LLMChain } = await import("./llm_chain.js");
        return LLMChain.deserialize(data);
      }
      case "sequential_chain": {
        const { SequentialChain } = await import("./sequential_chain.js");
        return SequentialChain.deserialize(data);
      }
      case "simple_sequential_chain": {
        const { SimpleSequentialChain } = await import("./sequential_chain.js");
        return SimpleSequentialChain.deserialize(data);
      }
      case "stuff_documents_chain": {
        const { StuffDocumentsChain } = await import("./combine_docs_chain.js");
        return StuffDocumentsChain.deserialize(data);
      }
      case "map_reduce_documents_chain": {
        const { MapReduceDocumentsChain } = await import(
          "./combine_docs_chain.js"
        );
        return MapReduceDocumentsChain.deserialize(data);
      }
      case "refine_documents_chain": {
        const { RefineDocumentsChain } = await import(
          "./combine_docs_chain.js"
        );
        return RefineDocumentsChain.deserialize(data);
      }
      case "vector_db_qa": {
        const { VectorDBQAChain } = await import("./vector_db_qa.js");
        return VectorDBQAChain.deserialize(data, values);
      }
      case "api_chain": {
        const { APIChain } = await import("./api/api_chain.js");
        return APIChain.deserialize(data);
      }
      default:
        throw new Error(
          `Invalid prompt type in config: ${
            (data as SerializedBaseChain)._type
          }`
        );
    }
  }
}
