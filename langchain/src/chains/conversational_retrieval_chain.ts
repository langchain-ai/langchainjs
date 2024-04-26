import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { BaseRetrieverInterface } from "@langchain/core/retrievers";
import { PromptTemplate } from "@langchain/core/prompts";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChainValues } from "@langchain/core/utils/types";
import { CallbackManagerForChainRun } from "@langchain/core/callbacks/manager";
import { SerializedChatVectorDBQAChain } from "./serde.js";
import { BaseChain, ChainInputs } from "./base.js";
import { LLMChain } from "./llm_chain.js";
import { QAChainParams, loadQAChain } from "./question_answering/load.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

const question_generator_template = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;

/**
 * Interface for the input parameters of the
 * ConversationalRetrievalQAChain class.
 */
export interface ConversationalRetrievalQAChainInput extends ChainInputs {
  retriever: BaseRetrieverInterface;
  combineDocumentsChain: BaseChain;
  questionGeneratorChain: LLMChain;
  returnSourceDocuments?: boolean;
  returnGeneratedQuestion?: boolean;
  inputKey?: string;
}

/**
 * @deprecated This class will be removed in 0.3.0. See below for an example implementation using
 * `createRetrievalChain`.
 *
 * Class for conducting conversational question-answering tasks with a
 * retrieval component. Extends the BaseChain class and implements the
 * ConversationalRetrievalQAChainInput interface.
 * @example
 * ```typescript
 * import { ChatAnthropic } from "@langchain/anthropic";
 * import {
 *   ChatPromptTemplate,
 *   MessagesPlaceholder,
 * } from "@langchain/core/prompts";
 * import { BaseMessage } from "@langchain/core/messages";
 * import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
 * import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
 * import { createRetrievalChain } from "langchain/chains/retrieval";
 *
 * const retriever = ...your retriever;
 * const llm = new ChatAnthropic();
 *
 * // Contextualize question
 * const contextualizeQSystemPrompt = `
 * Given a chat history and the latest user question
 * which might reference context in the chat history,
 * formulate a standalone question which can be understood
 * without the chat history. Do NOT answer the question, just
 * reformulate it if needed and otherwise return it as is.`;
 * const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
 *   ["system", contextualizeQSystemPrompt],
 *   new MessagesPlaceholder("chat_history"),
 *   ["human", "{input}"],
 * ]);
 * const historyAwareRetriever = await createHistoryAwareRetriever({
 *   llm,
 *   retriever,
 *   rephrasePrompt: contextualizeQPrompt,
 * });
 *
 * // Answer question
 * const qaSystemPrompt = `
 * You are an assistant for question-answering tasks. Use
 * the following pieces of retrieved context to answer the
 * question. If you don't know the answer, just say that you
 * don't know. Use three sentences maximum and keep the answer
 * concise.
 * \n\n
 * {context}`;
 * const qaPrompt = ChatPromptTemplate.fromMessages([
 *   ["system", qaSystemPrompt],
 *   new MessagesPlaceholder("chat_history"),
 *   ["human", "{input}"],
 * ]);
 *
 * // Below we use createStuffDocuments_chain to feed all retrieved context
 * // into the LLM. Note that we can also use StuffDocumentsChain and other
 * // instances of BaseCombineDocumentsChain.
 * const questionAnswerChain = await createStuffDocumentsChain({
 *   llm,
 *   prompt: qaPrompt,
 * });
 *
 * const ragChain = await createRetrievalChain({
 *   retriever: historyAwareRetriever,
 *   combineDocsChain: questionAnswerChain,
 * });
 *
 * // Usage:
 * const chat_history: BaseMessage[] = [];
 * const response = await ragChain.invoke({
 *   chat_history,
 *   input: "...",
 * });
 * ```
 */
export class ConversationalRetrievalQAChain
  extends BaseChain
  implements ConversationalRetrievalQAChainInput
{
  static lc_name() {
    return "ConversationalRetrievalQAChain";
  }

  inputKey = "question";

  chatHistoryKey = "chat_history";

  get inputKeys() {
    return [this.inputKey, this.chatHistoryKey];
  }

  get outputKeys() {
    return this.combineDocumentsChain.outputKeys.concat(
      this.returnSourceDocuments ? ["sourceDocuments"] : []
    );
  }

  retriever: BaseRetrieverInterface;

  combineDocumentsChain: BaseChain;

  questionGeneratorChain: LLMChain;

  returnSourceDocuments = false;

  returnGeneratedQuestion = false;

  constructor(fields: ConversationalRetrievalQAChainInput) {
    super(fields);
    this.retriever = fields.retriever;
    this.combineDocumentsChain = fields.combineDocumentsChain;
    this.questionGeneratorChain = fields.questionGeneratorChain;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.returnSourceDocuments =
      fields.returnSourceDocuments ?? this.returnSourceDocuments;
    this.returnGeneratedQuestion =
      fields.returnGeneratedQuestion ?? this.returnGeneratedQuestion;
  }

  /**
   * Static method to convert the chat history input into a formatted
   * string.
   * @param chatHistory Chat history input which can be a string, an array of BaseMessage instances, or an array of string arrays.
   * @returns A formatted string representing the chat history.
   */
  static getChatHistoryString(
    chatHistory: string | BaseMessage[] | string[][]
  ) {
    let historyMessages: BaseMessage[];
    if (Array.isArray(chatHistory)) {
      // TODO: Deprecate on a breaking release
      if (
        Array.isArray(chatHistory[0]) &&
        typeof chatHistory[0][0] === "string"
      ) {
        console.warn(
          "Passing chat history as an array of strings is deprecated.\nPlease see https://js.langchain.com/docs/modules/chains/popular/chat_vector_db#externally-managed-memory for more information."
        );
        historyMessages = chatHistory.flat().map((stringMessage, i) => {
          if (i % 2 === 0) {
            return new HumanMessage(stringMessage);
          } else {
            return new AIMessage(stringMessage);
          }
        });
      } else {
        historyMessages = chatHistory as BaseMessage[];
      }
      return historyMessages
        .map((chatMessage) => {
          if (chatMessage._getType() === "human") {
            return `Human: ${chatMessage.content}`;
          } else if (chatMessage._getType() === "ai") {
            return `Assistant: ${chatMessage.content}`;
          } else {
            return `${chatMessage.content}`;
          }
        })
        .join("\n");
    }
    return chatHistory;
  }

  /** @ignore */
  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    if (!(this.inputKey in values)) {
      throw new Error(`Question key ${this.inputKey} not found.`);
    }
    if (!(this.chatHistoryKey in values)) {
      throw new Error(`Chat history key ${this.chatHistoryKey} not found.`);
    }
    const question: string = values[this.inputKey];
    const chatHistory: string =
      ConversationalRetrievalQAChain.getChatHistoryString(
        values[this.chatHistoryKey]
      );
    let newQuestion = question;
    if (chatHistory.length > 0) {
      const result = await this.questionGeneratorChain.call(
        {
          question,
          chat_history: chatHistory,
        },
        runManager?.getChild("question_generator")
      );
      const keys = Object.keys(result);
      if (keys.length === 1) {
        newQuestion = result[keys[0]];
      } else {
        throw new Error(
          "Return from llm chain has multiple values, only single values supported."
        );
      }
    }
    const docs = await this.retriever.getRelevantDocuments(
      newQuestion,
      runManager?.getChild("retriever")
    );
    const inputs = {
      question: newQuestion,
      input_documents: docs,
      chat_history: chatHistory,
    };
    let result = await this.combineDocumentsChain.call(
      inputs,
      runManager?.getChild("combine_documents")
    );
    if (this.returnSourceDocuments) {
      result = {
        ...result,
        sourceDocuments: docs,
      };
    }
    if (this.returnGeneratedQuestion) {
      result = {
        ...result,
        generatedQuestion: newQuestion,
      };
    }
    return result;
  }

  _chainType(): string {
    return "conversational_retrieval_chain";
  }

  static async deserialize(
    _data: SerializedChatVectorDBQAChain,
    _values: LoadValues
  ): Promise<ConversationalRetrievalQAChain> {
    throw new Error("Not implemented.");
  }

  serialize(): SerializedChatVectorDBQAChain {
    throw new Error("Not implemented.");
  }

  /**
   * Static method to create a new ConversationalRetrievalQAChain from a
   * BaseLanguageModel and a BaseRetriever.
   * @param llm {@link BaseLanguageModelInterface} instance used to generate a new question.
   * @param retriever {@link BaseRetrieverInterface} instance used to retrieve relevant documents.
   * @param options.returnSourceDocuments Whether to return source documents in the final output
   * @param options.questionGeneratorChainOptions Options to initialize the standalone question generation chain used as the first internal step
   * @param options.qaChainOptions {@link QAChainParams} used to initialize the QA chain used as the second internal step
   * @returns A new instance of ConversationalRetrievalQAChain.
   */
  static fromLLM(
    llm: BaseLanguageModelInterface,
    retriever: BaseRetrieverInterface,
    options: {
      outputKey?: string; // not used
      returnSourceDocuments?: boolean;
      /** @deprecated Pass in questionGeneratorChainOptions.template instead */
      questionGeneratorTemplate?: string;
      /** @deprecated Pass in qaChainOptions.prompt instead */
      qaTemplate?: string;
      questionGeneratorChainOptions?: {
        llm?: BaseLanguageModelInterface;
        template?: string;
      };
      qaChainOptions?: QAChainParams;
    } & Omit<
      ConversationalRetrievalQAChainInput,
      "retriever" | "combineDocumentsChain" | "questionGeneratorChain"
    > = {}
  ): ConversationalRetrievalQAChain {
    const {
      questionGeneratorTemplate,
      qaTemplate,
      qaChainOptions = {
        type: "stuff",
        prompt: qaTemplate
          ? PromptTemplate.fromTemplate(qaTemplate)
          : undefined,
      },
      questionGeneratorChainOptions,
      verbose,
      ...rest
    } = options;

    const qaChain = loadQAChain(llm, qaChainOptions);

    const questionGeneratorChainPrompt = PromptTemplate.fromTemplate(
      questionGeneratorChainOptions?.template ??
        questionGeneratorTemplate ??
        question_generator_template
    );
    const questionGeneratorChain = new LLMChain({
      prompt: questionGeneratorChainPrompt,
      llm: questionGeneratorChainOptions?.llm ?? llm,
      verbose,
    });
    const instance = new this({
      retriever,
      combineDocumentsChain: qaChain,
      questionGeneratorChain,
      verbose,
      ...rest,
    });
    return instance;
  }
}
