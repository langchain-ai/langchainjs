import { BaseChain, ChainInputs } from "./base.js";
import { GraphStore } from "../graphstores/base.js";
import { SerializedGraphQAChain } from "./serde.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";
import { ChainValues } from "../schema/index.js";
import { loadQAStuffChain } from "./question_answering/load.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

/**
 * Interface that extends the `ChainInputs` interface and defines the
 * input fields required for a GraphQAChain. It includes properties
 * such as `graphstore`, `combineDocumentsChain`,
 * `returnSourceDocuments`, `k`, and `inputKey`.
 */
export interface GraphQAChainInput extends Omit<ChainInputs, "memory"> {
  graphstore: GraphStore;
  combineDocumentsChain: BaseChain;
  returnSourceDocuments?: boolean;
  k?: number;
  inputKey?: string;
}

/**
 * Class that represents a GraphQAChain. It extends the `BaseChain`
 * class and implements the `GraphQAChainInput` interface. It performs
 * a similarity search using a knowledge graph and combines the search
 * results using a specified combine documents chain.
 */
export class GraphQAChain extends BaseChain implements GraphQAChainInput {
  static lc_name() {
    return "GraphQAChain";
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

  graphstore: GraphStore;

  combineDocumentsChain: BaseChain;

  returnSourceDocuments = false;

  constructor(fields: GraphQAChainInput) {
    super(fields);
    this.graphstore = fields.graphstore;
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
    const docs = await this.graphstore.similaritySearch(
      question,
      this.k,
      values.filter,
      runManager?.getChild("graphstore")
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
    return "graph_qa" as const;
  }

  static async deserialize(
    data: SerializedGraphQAChain,
    values: LoadValues
  ) {
    if (!("graphstore" in values)) {
      throw new Error(
        `Need to pass in a graphstore to deserialize GraphQAChain`
      );
    }
    const { graphstore } = values;
    if (!data.combine_documents_chain) {
      throw new Error(
        `GraphQAChain must have combine_documents_chain in serialized data`
      );
    }

    return new GraphQAChain({
      combineDocumentsChain: await BaseChain.deserialize(
        data.combine_documents_chain
      ),
      k: data.k,
      graphstore,
    });
  }

  serialize(): SerializedGraphQAChain {
    return {
      _type: this._chainType(),
      combine_documents_chain: this.combineDocumentsChain.serialize(),
      k: this.k,
    };
  }

  /**
   * Static method that creates a GraphQAChain instance from a
   * BaseLanguageModel and a graph store. It also accepts optional options
   * to customize the chain.
   * @param llm The BaseLanguageModel instance.
   * @param graphstore The graph store used for similarity search.
   * @param options Optional options to customize the chain.
   * @returns A new instance of GraphQAChain.
   */
  static fromLLM(
    llm: BaseLanguageModel,
    graphstore: GraphStore,
    options?: Partial<
      Omit<GraphQAChainInput, "combineDocumentsChain" | "graphstore">
    >
  ): GraphQAChain {
    const qaChain = loadQAStuffChain(llm);
    return new this({
      graphstore,
      combineDocumentsChain: qaChain,
      ...options,
    });
  }
}
