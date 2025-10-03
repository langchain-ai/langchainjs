import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { VectorStoreInterface } from "@langchain/core/vectorstores";
import { ChainValues } from "@langchain/core/utils/types";
import { CallbackManagerForChainRun } from "@langchain/core/callbacks/manager";
import { PromptTemplate } from "@langchain/core/prompts";
import { SerializedChatVectorDBQAChain } from "./serde.js";
import { BaseChain, ChainInputs } from "./base.js";
import { LLMChain } from "./llm_chain.js";
import { loadQAStuffChain } from "./question_answering/load.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

const question_generator_template = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;

const qa_template = `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

{context}

Question: {question}
Helpful Answer:`;

/**
 * Interface for the input parameters of the ChatVectorDBQAChain class.
 */
export interface ChatVectorDBQAChainInput extends ChainInputs {
  vectorstore: VectorStoreInterface;
  combineDocumentsChain: BaseChain;
  questionGeneratorChain: LLMChain;
  returnSourceDocuments?: boolean;
  outputKey?: string;
  inputKey?: string;
  k?: number;
}

/** @deprecated use `ConversationalRetrievalQAChain` instead. */
export class ChatVectorDBQAChain
  extends BaseChain
  implements ChatVectorDBQAChainInput
{
  k = 4;

  inputKey = "question";

  chatHistoryKey = "chat_history";

  get inputKeys() {
    return [this.inputKey, this.chatHistoryKey];
  }

  outputKey = "result";

  get outputKeys() {
    return [this.outputKey];
  }

  vectorstore: VectorStoreInterface;

  combineDocumentsChain: BaseChain;

  questionGeneratorChain: LLMChain;

  returnSourceDocuments = false;

  constructor(fields: ChatVectorDBQAChainInput) {
    super(fields);
    this.vectorstore = fields.vectorstore;
    this.combineDocumentsChain = fields.combineDocumentsChain;
    this.questionGeneratorChain = fields.questionGeneratorChain;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.outputKey = fields.outputKey ?? this.outputKey;
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
    if (!(this.chatHistoryKey in values)) {
      throw new Error(`chat history key ${this.inputKey} not found.`);
    }
    const question: string = values[this.inputKey];
    const chatHistory: string = values[this.chatHistoryKey];
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
      console.log("_call", values, keys);
      if (keys.length === 1) {
        newQuestion = result[keys[0]];
      } else {
        throw new Error(
          "Return from llm chain has multiple values, only single values supported."
        );
      }
    }
    const docs = await this.vectorstore.similaritySearch(
      newQuestion,
      this.k,
      undefined,
      runManager?.getChild("vectorstore")
    );
    const inputs = {
      question: newQuestion,
      input_documents: docs,
      chat_history: chatHistory,
    };
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
    return "chat-vector-db" as const;
  }

  static async deserialize(
    data: SerializedChatVectorDBQAChain,
    values: LoadValues
  ) {
    if (!("vectorstore" in values)) {
      throw new Error(
        `Need to pass in a vectorstore to deserialize VectorDBQAChain`
      );
    }
    const { vectorstore } = values;

    return new ChatVectorDBQAChain({
      combineDocumentsChain: await BaseChain.deserialize(
        data.combine_documents_chain
      ),
      questionGeneratorChain: await LLMChain.deserialize(
        data.question_generator
      ),
      k: data.k,
      vectorstore,
    });
  }

  serialize(): SerializedChatVectorDBQAChain {
    return {
      _type: this._chainType(),
      combine_documents_chain: this.combineDocumentsChain.serialize(),
      question_generator: this.questionGeneratorChain.serialize(),
      k: this.k,
    };
  }

  /**
   * Creates an instance of ChatVectorDBQAChain using a BaseLanguageModel
   * and other options.
   * @param llm Instance of BaseLanguageModel used to generate a new question.
   * @param vectorstore Instance of VectorStore used for vector operations.
   * @param options (Optional) Additional options for creating the ChatVectorDBQAChain instance.
   * @returns New instance of ChatVectorDBQAChain.
   */
  static fromLLM(
    llm: BaseLanguageModelInterface,
    vectorstore: VectorStoreInterface,
    options: {
      inputKey?: string;
      outputKey?: string;
      k?: number;
      returnSourceDocuments?: boolean;
      questionGeneratorTemplate?: string;
      qaTemplate?: string;
      verbose?: boolean;
    } = {}
  ): ChatVectorDBQAChain {
    const { questionGeneratorTemplate, qaTemplate, verbose, ...rest } = options;
    const question_generator_prompt = PromptTemplate.fromTemplate(
      questionGeneratorTemplate || question_generator_template
    );
    const qa_prompt = PromptTemplate.fromTemplate(qaTemplate || qa_template);

    const qaChain = loadQAStuffChain(llm, { prompt: qa_prompt, verbose });
    const questionGeneratorChain = new LLMChain({
      prompt: question_generator_prompt,
      llm,
      verbose,
    });
    const instance = new this({
      vectorstore,
      combineDocumentsChain: qaChain,
      questionGeneratorChain,
      ...rest,
    });
    return instance;
  }
}
