import { BaseMemory } from "../memory/index.js";
import { ChainValues } from "../schema/index.js";
import { CallbackManager, getCallbackManager } from "../callbacks/index.js";
import { SerializedBaseChain } from "./serde.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

export interface ChainInputs {
  memory?: BaseMemory;
  verbose?: boolean;
  callbackManager?: CallbackManager;
}

const getVerbosity = () => false;

/**
 * Base interface that all chains must implement.
 */
export abstract class BaseChain implements ChainInputs {
  memory?: BaseMemory;

  verbose: boolean;

  callbackManager: CallbackManager;

  constructor(
    memory?: BaseMemory,
    verbose?: boolean,
    callbackManager?: CallbackManager
  ) {
    this.memory = memory;
    this.verbose = verbose ?? (callbackManager ? true : getVerbosity());
    this.callbackManager = callbackManager ?? getCallbackManager();
  }

  /**
   * Run the core logic of this chain and return the output
   */
  abstract _call(values: ChainValues): Promise<ChainValues>;

  /**
   * Return the string type key uniquely identifying this class of chain.
   */
  abstract _chainType(): string;

  /**
   * Return a json-like object representing this chain.
   */
  abstract serialize(): SerializedBaseChain;

  abstract get inputKeys(): string[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async run(input: any): Promise<string> {
    const isKeylessInput = this.inputKeys.length === 1;
    if (!isKeylessInput) {
      throw new Error(
        `Chain ${this._chainType()} expects multiple inputs, cannot use 'run' `
      );
    }
    const values = { [this.inputKeys[0]]: input };
    const returnValues = await this.call(values);
    const keys = Object.keys(returnValues);
    if (keys.length === 1) {
      const finalReturn = returnValues[keys[0]];
      return finalReturn;
    }
    throw new Error(
      "return values have multiple keys, `run` only supported when one key currently"
    );
  }

  /**
   * Run the core logic of this chain and add to output if desired.
   *
   * Wraps {@link _call} and handles memory.
   */
  async call(values: ChainValues): Promise<ChainValues> {
    const fullValues = { ...values } as typeof values;
    if (!(this.memory == null)) {
      const newValues = await this.memory.loadMemoryVariables(values);
      for (const [key, value] of Object.entries(newValues)) {
        fullValues[key] = value;
      }
    }
    await this.callbackManager.handleChainStart(
      { name: this._chainType() },
      fullValues,
      this.verbose
    );
    let outputValues;
    try {
      outputValues = await this._call(fullValues);
    } catch (e) {
      await this.callbackManager.handleChainError(e, this.verbose);
      throw e;
    }
    await this.callbackManager.handleChainEnd(outputValues, this.verbose);
    if (!(this.memory == null)) {
      await this.memory.saveContext(values, outputValues);
    }
    return outputValues;
  }

  /**
   * Call the chain on all inputs in the list
   */
  async apply(inputs: ChainValues[]): Promise<ChainValues> {
    return Promise.all(inputs.map(async (i) => this.call(i)));
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
      case "stuff_documents_chain": {
        const { StuffDocumentsChain } = await import("./combine_docs_chain.js");
        return StuffDocumentsChain.deserialize(data);
      }
      case "vector_db_qa": {
        const { VectorDBQAChain } = await import("./vector_db_qa.js");
        return VectorDBQAChain.deserialize(data, values);
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
