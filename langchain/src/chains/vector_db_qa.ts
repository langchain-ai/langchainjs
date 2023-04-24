import { BaseChain, ChainInputs } from "./base.js";
import { VectorStore } from "../vectorstores/base.js";
import { SerializedVectorDBQAChain } from "./serde.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";
import { ChainValues } from "../schema/index.js";
import { loadQAStuffChain } from "./question_answering/load.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

export interface VectorDBQAChainInput extends Omit<ChainInputs, "memory"> {
  vectorstore: VectorStore;
  combineDocumentsChain: BaseChain;
  returnSourceDocuments?: boolean;
  k?: number;
  inputKey?: string;
}

export class VectorDBQAChain extends BaseChain implements VectorDBQAChainInput {
  k = 4;

  inputKey = "query";

  get inputKeys() {
    return [this.inputKey];
  }

  get outputKeys() {
    return this.combineDocumentsChain.outputKeys.concat(
      this.returnSourceDocuments ? ["sourceDocuments"] : []
    );
  }

  vectorstore: VectorStore;

  combineDocumentsChain: BaseChain;

  returnSourceDocuments = false;

  constructor(fields: VectorDBQAChainInput) {
    super(undefined, fields.verbose, fields.callbackManager);
    this.vectorstore = fields.vectorstore;
    this.combineDocumentsChain = fields.combineDocumentsChain;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.k = fields.k ?? this.k;
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
    const docs = await this.vectorstore.similaritySearch(question, this.k);
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
    return "vector_db_qa" as const;
  }

  static async deserialize(
    data: SerializedVectorDBQAChain,
    values: LoadValues
  ) {
    if (!("vectorstore" in values)) {
      throw new Error(
        `Need to pass in a vectorstore to deserialize VectorDBQAChain`
      );
    }
    const { vectorstore } = values;
    if (!data.combine_documents_chain) {
      throw new Error(
        `VectorDBQAChain must have combine_documents_chain in serialized data`
      );
    }

    return new VectorDBQAChain({
      combineDocumentsChain: await BaseChain.deserialize(
        data.combine_documents_chain
      ),
      k: data.k,
      vectorstore,
    });
  }

  serialize(): SerializedVectorDBQAChain {
    return {
      _type: this._chainType(),
      combine_documents_chain: this.combineDocumentsChain.serialize(),
      k: this.k,
    };
  }

  static fromLLM(
    llm: BaseLanguageModel,
    vectorstore: VectorStore,
    options?: Partial<
      Omit<VectorDBQAChainInput, "combineDocumentsChain" | "vectorstore">
    >
  ): VectorDBQAChain {
    const qaChain = loadQAStuffChain(llm);
    return new this({
      vectorstore,
      combineDocumentsChain: qaChain,
      ...options,
    });
  }
}
