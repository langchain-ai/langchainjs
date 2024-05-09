import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { BaseRetrieverInterface } from "@langchain/core/retrievers";
import { ChainValues } from "@langchain/core/utils/types";
import { CallbackManagerForChainRun } from "@langchain/core/callbacks/manager";
import { BaseChain, ChainInputs } from "./base.js";
import { SerializedVectorDBQAChain } from "./serde.js";
import {
  StuffQAChainParams,
  loadQAStuffChain,
} from "./question_answering/load.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

/**
 * Interface for the input parameters of the RetrievalQAChain class.
 */
export interface RetrievalQAChainInput extends Omit<ChainInputs, "memory"> {
  retriever: BaseRetrieverInterface;
  combineDocumentsChain: BaseChain;
  inputKey?: string;
  returnSourceDocuments?: boolean;
}

/**
 * @deprecated This class will be removed in 0.3.0. See below for an example implementation using
 * `createRetrievalChain`:
 * Class representing a chain for performing question-answering tasks with
 * a retrieval component.
 * @example
 * ```typescript
 * import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
 * import { ChatPromptTemplate } from "@langchain/core/prompts";
 * import { createRetrievalChain } from "langchain/chains/retrieval";
 * import { MemoryVectorStore } from "langchain/vectorstores/memory";
 *
 * const documents = [...your documents here];
 * const embeddings = ...your embeddings model;
 * const llm = ...your LLM model;
 *
 * const vectorstore = await MemoryVectorStore.fromDocuments(
 *   documents,
 *   embeddings
 * );
 * const prompt = ChatPromptTemplate.fromTemplate(`Answer the user's question: {input}`);
 *
 * const combineDocsChain = await createStuffDocumentsChain({
 *   llm,
 *   prompt,
 * });
 * const retriever = vectorstore.asRetriever();
 *
 * const retrievalChain = await createRetrievalChain({
 *   combineDocsChain,
 *   retriever,
 * });
 * ```
 */
export class RetrievalQAChain
  extends BaseChain
  implements RetrievalQAChainInput
{
  static lc_name() {
    return "RetrievalQAChain";
  }

  inputKey = "query";

  get inputKeys() {
    return [this.inputKey];
  }

  get outputKeys() {
    return this.combineDocumentsChain.outputKeys.concat(
      this.returnSourceDocuments ? ["sourceDocuments"] : []
    );
  }

  retriever: BaseRetrieverInterface;

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
      throw new Error(`Question key "${this.inputKey}" not found.`);
    }
    const question: string = values[this.inputKey];
    const docs = await this.retriever.getRelevantDocuments(
      question,
      runManager?.getChild("retriever")
    );
    const inputs = { question, input_documents: docs, ...values };
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

  /**
   * Creates a new instance of RetrievalQAChain using a BaseLanguageModel
   * and a BaseRetriever.
   * @param llm The BaseLanguageModel used to generate a new question.
   * @param retriever The BaseRetriever used to retrieve relevant documents.
   * @param options Optional parameters for the RetrievalQAChain.
   * @returns A new instance of RetrievalQAChain.
   */
  static fromLLM(
    llm: BaseLanguageModelInterface,
    retriever: BaseRetrieverInterface,
    options?: Partial<
      Omit<
        RetrievalQAChainInput,
        "retriever" | "combineDocumentsChain" | "index"
      >
    > &
      StuffQAChainParams
  ): RetrievalQAChain {
    const qaChain = loadQAStuffChain(llm, {
      prompt: options?.prompt,
    });
    return new this({
      ...options,
      retriever,
      combineDocumentsChain: qaChain,
    });
  }
}
