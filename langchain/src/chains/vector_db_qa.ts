import { BaseChain, ChainInputs } from "./base.js";
import { VectorStore } from "../vectorstores/base.js";
import { SerializedVectorDBQAChain } from "./serde.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";
import { ChainValues } from "../schema/index.js";
import { loadQAStuffChain } from "./question_answering/load.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

/**
 * Interface that extends the `ChainInputs` interface and defines the
 * input fields required for a VectorDBQAChain. It includes properties
 * such as `vectorstore`, `combineDocumentsChain`,
 * `returnSourceDocuments`, `k`, and `inputKey`.
 */
export interface VectorDBQAChainInput extends Omit<ChainInputs, "memory"> {
  vectorstore: VectorStore;
  combineDocumentsChain: BaseChain;
  returnSourceDocuments?: boolean;
  k?: number;
  inputKey?: string;
}

/**
 * Class that represents a VectorDBQAChain. It extends the `BaseChain`
 * class and implements the `VectorDBQAChainInput` interface. It performs
 * a similarity search using a vector store and combines the search
 * results using a specified combine documents chain.
 */
export class VectorDBQAChain extends BaseChain implements VectorDBQAChainInput {
  static lc_name() {
    return "VectorDBQAChain";
  }

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
    super(fields);
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
    const docs = await this.vectorstore.similaritySearch(
      question,
      this.k,
      values.filter,
      runManager?.getChild("vectorstore")
    );
    const inputs = { question, input_documents: docs };
    const result = await this.combineDocumentsChain.call(
      inputs,
      runManager?.getChild("combine_documents")
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

  /**
   * Static method that creates a VectorDBQAChain instance from a
   * BaseLanguageModel and a vector store. It also accepts optional options
   * to customize the chain.
   * @param llm The BaseLanguageModel instance.
   * @param vectorstore The vector store used for similarity search.
   * @param options Optional options to customize the chain.
   * @returns A new instance of VectorDBQAChain.
   */
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
