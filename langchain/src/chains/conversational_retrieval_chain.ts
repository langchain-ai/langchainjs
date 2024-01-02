import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { BaseRetrieverInterface } from "@langchain/core/retrievers";
import { PromptTemplate } from "@langchain/core/prompts";
import { SerializedChatVectorDBQAChain } from "./serde.js";
import {
  ChainValues,
  BaseMessage,
  HumanMessage,
  AIMessage,
} from "../schema/index.js";
import { BaseChain, ChainInputs } from "./base.js";
import { LLMChain } from "./llm_chain.js";
import { QAChainParams, loadQAChain } from "./question_answering/load.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";

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
 * Class for conducting conversational question-answering tasks with a
 * retrieval component. Extends the BaseChain class and implements the
 * ConversationalRetrievalQAChainInput interface.
 * @example
 * ```typescript
 * const model = new ChatAnthropic({});
 *
 * const text = fs.readFileSync("state_of_the_union.txt", "utf8");
 *
 * const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
 * const docs = await textSplitter.createDocuments([text]);
 *
 * const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
 *
 * const chain = ConversationalRetrievalQAChain.fromLLM(
 *   model,
 *   vectorStore.asRetriever(),
 * );
 *
 * const question = "What did the president say about Justice Breyer?";
 *
 * const res = await chain.call({ question, chat_history: "" });
 * console.log(res);
 *
 * const chatHistory = `${question}\n${res.text}`;
 * const followUpRes = await chain.call({
 *   question: "Was that nice?",
 *   chat_history: chatHistory,
 * });
 * console.log(followUpRes);
 *
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
