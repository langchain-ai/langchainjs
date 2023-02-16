import { LLMChain, StuffDocumentsChain, VectorDBQAChain } from "./index";
import { BaseMemory } from "../memory";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChainValues = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

const chainClasses = [LLMChain, StuffDocumentsChain, VectorDBQAChain];

export type SerializedBaseChain = ReturnType<
  InstanceType<(typeof chainClasses)[number]>["serialize"]
>;

export interface ChainInputs {
  memory?: BaseMemory;
}

export abstract class BaseChain implements ChainInputs {
  memory?: BaseMemory;

  abstract _call(values: ChainValues): Promise<ChainValues>;

  abstract _chainType(): string;

  abstract serialize(): SerializedBaseChain;

  async call(values: ChainValues): Promise<ChainValues> {
    const fullValues = structuredClone(values);
    if (!(this.memory == null)) {
      const newValues = await this.memory.loadMemoryVariables(values);
      for (const [key, value] of Object.entries(newValues)) {
        fullValues[key] = value;
      }
    }
    // TODO(sean) add callback support
    const outputValues = this._call(fullValues);
    if (!(this.memory == null)) {
      this.memory.saveContext(values, outputValues);
    }
    return outputValues;
  }

  apply(inputs: ChainValues[]): ChainValues[] {
    return inputs.map(this.call);
  }

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
