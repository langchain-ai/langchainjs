import { BaseChain } from "./base.js";
import { BaseLLM } from "../llms/base.js";
import { SerializedVectorDBQAChain } from "./serde.js";
import { ChainValues, BaseRetriever } from "../schema/index.js";
import { loadQAStuffChain } from "./question_answering/load.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

export interface RetrievalQAChainInput {
  retriever: BaseRetriever;
  combineDocumentsChain: BaseChain;
  outputKey: string;
  inputKey: string;
  returnSourceDocuments?: boolean;
}

export class RetrievalQAChain
  extends BaseChain
  implements RetrievalQAChainInput
{
  inputKey = "query";

  get inputKeys() {
    return [this.inputKey];
  }

  outputKey = "result";

  retriever: BaseRetriever;

  combineDocumentsChain: BaseChain;

  returnSourceDocuments = false;

  constructor(fields: {
    retriever: BaseRetriever;
    combineDocumentsChain: BaseChain;
    inputKey?: string;
    outputKey?: string;
    returnSourceDocuments?: boolean;
  }) {
    super();
    this.retriever = fields.retriever;
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
    const docs = await this.retriever.getRelevantDocuments(question);
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
    return "retrieval_qa" as const;
  }

  static async deserialize(
    _data: SerializedVectorDBQAChain,
    _values: LoadValues
  ): Promise<RetrievalQAChain> {
    throw new Error("Not implemented");
  }

  serialize(): SerializedVectorDBQAChain {
    throw new Error("Not implemented");
  }

  static fromLLM(
    llm: BaseLLM,
    retriever: BaseRetriever,
    options?: Partial<
      Omit<RetrievalQAChainInput, "combineDocumentsChain" | "index">
    >
  ): RetrievalQAChain {
    const qaChain = loadQAStuffChain(llm);
    return new this({
      retriever,
      combineDocumentsChain: qaChain,
      ...options,
    });
  }
}
