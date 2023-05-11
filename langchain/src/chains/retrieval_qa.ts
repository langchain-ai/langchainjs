import { BaseChain, ChainInputs } from "./base.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { SerializedVectorDBQAChain } from "./serde.js";
import { ChainValues, BaseRetriever } from "../schema/index.js";
import {
  StuffQAChainParams,
  loadQAStuffChain,
} from "./question_answering/load.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

export interface RetrievalQAChainInput extends Omit<ChainInputs, "memory"> {
  retriever: BaseRetriever;
  combineDocumentsChain: BaseChain;
  inputKey?: string;
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

  get outputKeys() {
    return this.combineDocumentsChain.outputKeys.concat(
      this.returnSourceDocuments ? ["sourceDocuments"] : []
    );
  }

  retriever: BaseRetriever;

  combineDocumentsChain: BaseChain;

  returnSourceDocuments = false;

  constructor(fields: RetrievalQAChainInput) {
    super(fields);
    this.retriever = fields.retriever;
    this.combineDocumentsChain = fields.combineDocumentsChain;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.returnSourceDocuments =
      fields.returnSourceDocuments ?? this.returnSourceDocuments;
  }

  /** @ignore */
  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    if (!(this.inputKey in values)) {
      throw new Error(`Question key ${this.inputKey} not found.`);
    }
    const question: string = values[this.inputKey];
    const docs = await this.retriever.getRelevantDocuments(question);
    const inputs = { question, input_documents: docs };
    const result = await this.combineDocumentsChain.call(
      inputs,
      runManager?.getChild()
    );
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
    llm: BaseLanguageModel,
    retriever: BaseRetriever,
    options?: Partial<
      Omit<RetrievalQAChainInput, "combineDocumentsChain" | "index">
    > &
      StuffQAChainParams
  ): RetrievalQAChain {
    const qaChain = loadQAStuffChain(llm, {
      prompt: options?.prompt,
    });
    return new this({
      retriever,
      combineDocumentsChain: qaChain,
      ...options,
    });
  }
}
