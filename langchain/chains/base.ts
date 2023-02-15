import { LLMChain, StuffDocumentsChain } from "./index";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChainValues = Record<string, any>;

const chainClasses = [LLMChain, StuffDocumentsChain];

export type SerializedBaseChain = ReturnType<
  InstanceType<(typeof chainClasses)[number]>["serialize"]
>;

export abstract class BaseChain {
  abstract _call(values: ChainValues): Promise<ChainValues>;

  abstract _chainType(): string;

  abstract serialize(): SerializedBaseChain;

  call(values: ChainValues): Promise<ChainValues> {
    // TODO(sean) add callback support
    return this._call(values);
  }

  apply(inputs: ChainValues[]): ChainValues[] {
    return inputs.map(this.call);
  }

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
