import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { BaseRetrieverInterface } from "@langchain/core/retrievers";
import {
  type Runnable,
  RunnableSequence,
  type RunnableInterface,
  RunnablePassthrough,
} from "@langchain/core/runnables";
import type { BaseMessage } from "@langchain/core/messages";
import type { DocumentInterface } from "@langchain/core/documents";
import { BaseChain, ChainInputs } from "./base.js";
import { SerializedVectorDBQAChain } from "./serde.js";
import { ChainValues } from "../schema/index.js";
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
  retriever: BaseRetrieverInterface;
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

/**
 * Parameters for the createRetrievalChain method.
 */
export type CreateRetrievalChainParams = {
  /**
   * Retriever-like object that returns list of documents. Should
   * either be a subclass of BaseRetriever or a Runnable that returns
   * a list of documents. If a subclass of BaseRetriever, then it
   * is expected that an `input` key be passed in - this is what
   * is will be used to pass into the retriever. If this is NOT a
   * subclass of BaseRetriever, then all the inputs will be passed
   * into this runnable, meaning that runnable should take a object
   * as input.
   */
  retriever:
    | BaseRetrieverInterface
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | RunnableInterface<Record<string, any>, DocumentInterface[]>;
  /**
   * Runnable that takes inputs and produces a string output.
   * The inputs to this will be any original inputs to this chain, a new
   * context key with the retrieved documents, and chat_history (if not present
   * in the inputs) with a value of `[]` (to easily enable conversational
   * retrieval.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  combineDocsChain: RunnableInterface<Record<string, any>, string>;
};

function isBaseRetriever(x: unknown): x is BaseRetrieverInterface {
  return (
    !!x &&
    typeof (x as BaseRetrieverInterface).getRelevantDocuments === "function"
  );
}

/**
 * Create a retrieval chain that retrieves documents and then passes them on.
 * @param {CreateRetrievalChainParams} params A params object
 *     containing a retriever and a combineDocsChain.
 * @returns An LCEL Runnable which returns a an object
 *     containing at least `context` and `answer` keys.
 * @example
 * ```typescript
 * // TODO
 * ```
 */
export function createRetrievalChain({
  retriever,
  combineDocsChain,
}: CreateRetrievalChainParams): RunnableInterface<
  { input: string; chat_history?: BaseMessage[] | string },
  { context: string; answer: string } & { [key: string]: unknown }
> {
  let retrieveDocumentsChain: Runnable<{ input: string }, DocumentInterface[]>;
  if (isBaseRetriever(retriever)) {
    retrieveDocumentsChain = RunnableSequence.from([
      (input) => input.input,
      retriever,
    ]);
  } else {
    // TODO: Fix typing by adding withConfig to core RunnableInterface
    retrieveDocumentsChain = retriever as Runnable;
  }
  const retrievalChain = RunnableSequence.from<{
    input: string;
    chat_history?: BaseMessage[] | string;
  }>([
    RunnablePassthrough.assign({
      context: retrieveDocumentsChain.withConfig({
        runName: "retrieve_documents",
      }),
      chat_history: (input) => input.chat_history ?? [],
    }),
    RunnablePassthrough.assign({
      answer: combineDocsChain,
    }),
  ]).withConfig({ runName: "retrieval_chain" });
  return retrievalChain;
}
