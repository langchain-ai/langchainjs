import deepcopy = require("deepcopy");
import {
  LLMChain,
  StuffDocumentsChain,
  VectorDBQAChain,
  ChatVectorDBQAChain,
  MapReduceDocumentsChain,
  AnalyzeDocumentChain,
} from "./index";
import { BaseMemory } from "../memory";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChainValues = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

const chainClasses = [
  LLMChain,
  StuffDocumentsChain,
  VectorDBQAChain,
  ChatVectorDBQAChain,
  MapReduceDocumentsChain,
  AnalyzeDocumentChain,
];

export type SerializedBaseChain = ReturnType<
  InstanceType<(typeof chainClasses)[number]>["serialize"]
>;

export interface ChainInputs {
  memory?: BaseMemory;
}

/**
 * Base interface that all chains must implement.
 */
export abstract class BaseChain implements ChainInputs {
  memory?: BaseMemory;

  constructor(memory?: BaseMemory) {
    this.memory = memory;
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
    const fullValues = deepcopy(values);

    if (!(this.memory == null)) {
      const newValues = await this.memory.loadMemoryVariables(values);
      for (const [key, value] of Object.entries(newValues)) {
        fullValues[key] = value;
      }
    }
    // TODO(sean) add callback support
    const outputValues = this._call(fullValues);
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
  static deserialize(
    data: SerializedBaseChain,
    values: LoadValues = {}
  ): Promise<BaseChain> {
    switch (data._type) {
      case "llm_chain":
        return LLMChain.deserialize(data);
      case "stuff_documents_chain":
        return StuffDocumentsChain.deserialize(data);
      case "vector_db_qa":
        return VectorDBQAChain.deserialize(data, values);
      default:
        throw new Error(
          `Invalid prompt type in config: ${
            (data as SerializedBaseChain)._type
          }`
        );
    }
  }
}
