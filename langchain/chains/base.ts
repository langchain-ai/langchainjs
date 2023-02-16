import { LLMChain, StuffDocumentsChain } from "./index";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChainValues = Record<string, any>;

const chainClasses = [LLMChain, StuffDocumentsChain];

export type SerializedBaseChain = ReturnType<
  InstanceType<(typeof chainClasses)[number]>["serialize"]
>;

/**
 * Base interface that all chains must implement.
 */
export abstract class BaseChain {
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

  /**
   * Run the core logic of this chain and add to output if desired.
   *
   * Eventually will handle memory, validation, etc. but for now just wraps {@link _call}
   */
  call(values: ChainValues): Promise<ChainValues> {
    // TODO(sean) add callback support
    return this._call(values);
  }

  /**
   * Call the chain on all inputs in the list
   */
  apply(inputs: ChainValues[]): ChainValues[] {
    return inputs.map(this.call);
  }

  /**
   * Load a chain from a json-like object describing it.
   */
  static deserialize(data: SerializedBaseChain): Promise<BaseChain> {
    switch (data._type) {
      case "llm_chain":
        return LLMChain.deserialize(data);
      case "stuff_documents_chain":
        return StuffDocumentsChain.deserialize(data);
      default:
        throw new Error(
          `Invalid prompt type in config: ${
            (data as SerializedBaseChain)._type
          }`
        );
    }
  }
}
