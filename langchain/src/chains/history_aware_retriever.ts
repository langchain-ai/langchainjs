import type { LanguageModelLike } from "@langchain/core/language_models/base";
import {
  type RunnableInterface,
  RunnableSequence,
  RunnableBranch,
} from "@langchain/core/runnables";
import { type BasePromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { DocumentInterface } from "@langchain/core/documents";
import type { BaseMessage } from "../schema/index.js";

/**
 * Params for the createHistoryAwareRetriever method.
 */
export type CreateHistoryAwareRetriever = {
  /**
   * Language model to use for generating a search term given chat history.
   */
  llm: LanguageModelLike;
  /**
   * RetrieverLike object that takes a string as input and outputs a list of Documents.
   */
  retriever: RunnableInterface<string, DocumentInterface[]>;
  /**
   * The prompt used to generate the search query for the retriever.
   */
  rephrasePrompt: BasePromptTemplate;
};

/**
 * Create a chain that takes conversation history and returns documents.
 * If there is no `chat_history`, then the `input` is just passed directly to the
 * retriever. If there is `chat_history`, then the prompt and LLM will be used
 * to generate a search query. That search query is then passed to the retriever.
 * @param {CreateHistoryAwareRetriever} params
 * @returns An LCEL Runnable. The runnable input must take in `input`, and if there
 * is chat history should take it in the form of `chat_history`.
 * The Runnable output is a list of Documents
 * @example
 * ```typescript
 * // yarn add langchain @langchain/openai
 *
 * import { ChatOpenAI } from "@langchain/openai";
 * import { pull } from "langchain/hub";
 * import { createRetrievalChain } from "langchain/chains/retrieval";
 * import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
 *
 * const rephrasePrompt = await pull("langchain-ai/chat-langchain-rephrase");
 * const llm = new ChatOpenAI({});
 * const retriever = ...
 * const historyAwareRetrieverChain = await createHistoryAwareRetriever({
 *   llm,
 *   retriever,
 *   rephrasePrompt,
 * });
 * const result = await chain.invoke({"input": "...", "chat_history": [] })
 * ```
 */
export async function createHistoryAwareRetriever({
  llm,
  retriever,
  rephrasePrompt,
}: CreateHistoryAwareRetriever): Promise<
  RunnableInterface<
    { input: string; chat_history: string | BaseMessage[] },
    DocumentInterface[]
  >
> {
  if (!rephrasePrompt.inputVariables.includes("input")) {
    throw new Error(
      `Expected "input" to be a prompt variable, but got ${JSON.stringify(
        rephrasePrompt.inputVariables
      )}`
    );
  }
  const retrieveDocuments = RunnableBranch.from([
    [
      (input) => !input.chat_history || input.chat_history.length === 0,
      RunnableSequence.from([(input) => input.input, retriever]),
    ],
    RunnableSequence.from([
      rephrasePrompt,
      llm,
      new StringOutputParser(),
      retriever,
    ]),
  ]).withConfig({
    runName: "history_aware_retriever",
  });
  return retrieveDocuments;
}
