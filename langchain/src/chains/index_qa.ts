import { BaseChain } from "./base.js";
import { BaseIndex } from "../schema/index.js";
import { BaseLLM } from "../llms/index.js";
import { SerializedVectorDBQAChain } from "./serde.js";
import { ChainValues } from "../schema/index.js";
import { loadQAStuffChain } from "./question_answering/load.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

export interface IndexQAChainInput {
  index: BaseIndex;
  combineDocumentsChain: BaseChain;
  outputKey: string;
  inputKey: string;
  returnSourceDocuments?: boolean;
}

export class IndexQAChain extends BaseChain implements IndexQAChainInput {
  inputKey = "query";

  get inputKeys() {
    return [this.inputKey];
  }

  outputKey = "result";

  index: BaseIndex;

  combineDocumentsChain: BaseChain;

  returnSourceDocuments = false;

  constructor(fields: {
    index: BaseIndex;
    combineDocumentsChain: BaseChain;
    inputKey?: string;
    outputKey?: string;
    returnSourceDocuments?: boolean;
  }) {
    super();
    this.index = fields.index;
    this.combineDocumentsChain = fields.combineDocumentsChain;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.returnSourceDocuments =
      fields.returnSourceDocuments ?? this.returnSourceDocuments;
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    if (!(this.inputKey in values)) {
      throw new Error(`Question key ${this.inputKey} not found.`);
    }
    const question: string = values[this.inputKey];
    const docs = await this.index.getRelevantTexts(question);
    const inputs = { question, input_documents: docs };
    const result = await this.combineDocumentsChain.call(inputs);
    if (this.returnSourceDocuments) {
      return {
        ...result,
        sourceDocuments: docs,
      };
    }
    return result;
  }

  _chainType() {
    return "index_qa" as const;
  }

  static async deserialize(
    _data: SerializedVectorDBQAChain,
    _values: LoadValues
  ): Promise<IndexQAChain> {
    throw new Error("Not implemented");
  }

  serialize(): SerializedVectorDBQAChain {
    throw new Error("Not implemented");
  }

  static fromLLM(
    llm: BaseLLM,
    index: BaseIndex,
    options?: Partial<
      Omit<IndexQAChainInput, "combineDocumentsChain" | "index">
    >
  ): IndexQAChain {
    const qaChain = loadQAStuffChain(llm);
    return new this({
      index,
      combineDocumentsChain: qaChain,
      ...options,
    });
  }
}
