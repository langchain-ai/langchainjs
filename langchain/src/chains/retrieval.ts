import type { BaseRetrieverInterface } from "@langchain/core/retrievers";
import {
  type Runnable,
  RunnableSequence,
  type RunnableInterface,
  RunnablePassthrough,
} from "@langchain/core/runnables";
import type { BaseMessage } from "@langchain/core/messages";
import type { DocumentInterface } from "@langchain/core/documents";

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
