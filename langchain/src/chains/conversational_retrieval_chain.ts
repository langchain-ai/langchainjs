import { PromptTemplate } from "../prompts/prompt.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { SerializedChatVectorDBQAChain } from "./serde.js";
import { ChainValues, BaseRetriever } from "../schema/index.js";
import { BaseChain, ChainInputs } from "./base.js";
import { LLMChain } from "./llm_chain.js";
import { loadQAStuffChain } from "./question_answering/load.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";

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

export interface ConversationalRetrievalQAChainInput
  extends Omit<ChainInputs, "memory"> {
  retriever: BaseRetriever;
  combineDocumentsChain: BaseChain;
  questionGeneratorChain: LLMChain;
  returnSourceDocuments?: boolean;
  inputKey?: string;
}

export class ConversationalRetrievalQAChain
  extends BaseChain
  implements ConversationalRetrievalQAChainInput
{
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

  retriever: BaseRetriever;

  combineDocumentsChain: BaseChain;

  questionGeneratorChain: LLMChain;

  returnSourceDocuments = false;

  constructor(fields: ConversationalRetrievalQAChainInput) {
    super(fields);
    this.retriever = fields.retriever;
    this.combineDocumentsChain = fields.combineDocumentsChain;
    this.questionGeneratorChain = fields.questionGeneratorChain;
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
        runManager?.getChild()
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
    const docs = await this.retriever.getRelevantDocuments(newQuestion);
    const inputs = {
      question: newQuestion,
      input_documents: docs,
      chat_history: chatHistory,
    };
    const result = await this.combineDocumentsChain.call(
      inputs,
      runManager?.getChild()
    );
    if (this.returnSourceDocuments) {
      return {
        ...result,
        sourceDocuments: docs,
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

  static fromLLM(
    llm: BaseLanguageModel,
    retriever: BaseRetriever,
    options: {
      outputKey?: string; // not used
      returnSourceDocuments?: boolean;
      questionGeneratorTemplate?: string;
      qaTemplate?: string;
    } & Omit<
      ConversationalRetrievalQAChainInput,
      "retriever" | "combineDocumentsChain" | "questionGeneratorChain"
    > = {}
  ): ConversationalRetrievalQAChain {
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
      retriever,
      combineDocumentsChain: qaChain,
      questionGeneratorChain,
      verbose,
      ...rest,
    });
    return instance;
  }
}
