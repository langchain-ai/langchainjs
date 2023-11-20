import { BaseChain, ChainInputs } from "./base.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { SerializedVectorDBQAChain } from "./serde.js";
import { ChainValues } from "../schema/index.js";
import { BaseRetriever } from "../schema/retriever.js";
import {
  StuffQAChainParams,
  loadQAStuffChain,
} from "./question_answering/load.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

/**
 * Interface for the input parameters of the RetrievalQAChain class.
 */
export interface RetrievalQAChainInput extends Omit<ChainInputs, "memory"> {
  retriever: BaseRetriever;
  combineDocumentsChain: BaseChain;
  inputKey?: string;
  returnSourceDocuments?: boolean;
}

/**
 * Class representing a chain for performing question-answering tasks with
 * a retrieval component.
 * @example
 * ```typescript
 * // Initialize the OpenAI model and the remote retriever with the specified configuration
 * const model = new ChatOpenAI({});
 * const retriever = new RemoteLangChainRetriever({
 *   url: "http://example.com/api",
 *   auth: { bearer: "foo" },
 *   inputKey: "message",
 *   responseKey: "response",
 * });
 *
 * // Create a RetrievalQAChain using the model and retriever
 * const chain = RetrievalQAChain.fromLLM(model, retriever);
 *
 * // Execute the chain with a query and log the result
 * const res = await chain.call({
 *   query: "What did the president say about Justice Breyer?",
 * });
 * console.log({ res });
 *
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
    llm: BaseLanguageModel,
    retriever: BaseRetriever,
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
