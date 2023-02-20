import {
  BaseChain,
  ChainValues,
  SerializedStuffDocumentsChain,
  StuffDocumentsChain,
  loadQAChain,
} from "./index";

import { VectorStore } from "../vectorstores/base";
import { BaseLLM } from "../llms";

import { resolveConfigFromFile } from "../util";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

export interface VectorDBQAChainInput {
  vectorstore: VectorStore;
  k: number;
  combineDocumentsChain: StuffDocumentsChain;
  outputKey: string;
  inputKey: string;
}

export type SerializedVectorDBQAChain = {
  _type: "vector_db_qa";
  k: number;
  combine_documents_chain: SerializedStuffDocumentsChain;
  combine_documents_chain_path?: string;
};

export class VectorDBQAChain extends BaseChain implements VectorDBQAChainInput {
  k = 4;

  inputKey = "query";

  outputKey = "result";

  vectorstore: VectorStore;

  combineDocumentsChain: StuffDocumentsChain;

  constructor(fields: {
    vectorstore: VectorStore;
    combineDocumentsChain: StuffDocumentsChain;
    inputKey?: string;
    outputKey?: string;
    k?: number;
  }) {
    super();
    this.vectorstore = fields.vectorstore;
    this.combineDocumentsChain = fields.combineDocumentsChain;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.k = fields.k ?? this.k;
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    if (!(this.inputKey in values)) {
      throw new Error(`Question key ${this.inputKey} not found.`);
    }
    const question: string = values[this.inputKey];
    const docs = await this.vectorstore.similaritySearch(question, this.k);
    const inputs = { question, input_documents: docs };
    const result = await this.combineDocumentsChain.call(inputs);
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
    const serializedCombineDocumentsChain = resolveConfigFromFile<
      "combine_documents_chain",
      SerializedStuffDocumentsChain
    >("combine_documents_chain", data);

    return new VectorDBQAChain({
      combineDocumentsChain: await StuffDocumentsChain.deserialize(
        serializedCombineDocumentsChain
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

  static fromLLM(llm: BaseLLM, vectorstore: VectorStore): VectorDBQAChain {
    const qaChain = loadQAChain(llm);
    const instance = new this({ vectorstore, combineDocumentsChain: qaChain });
    return instance;
  }
}
