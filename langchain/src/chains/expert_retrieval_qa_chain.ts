import { PromptTemplate } from "../prompts/prompt.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { SerializedChatVectorDBQAChain } from "./serde.js";
import {
  ChainValues,
  BaseMessage,
  HumanMessage,
  AIMessage,
} from "../schema/index.js";
import { BaseRetriever } from "../schema/retriever.js";
import { BaseChain, ChainInputs } from "./base.js";
import { LLMChain } from "./llm_chain.js";
import { QAChainParams, loadQAChain } from "./question_answering/load.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";
import {
  Locale,
  PersonaRole,
  meyerBriggsTypes as meyerBriggsTypesDict,
} from "../types/expert-types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;

// TODO: chat_history guard rails
// TODO: Add default MBTI & gptParams
// TODO: nKeywords? -> Task or not
// TODO Add Zod validation
// TODO Add internationalized instruction prompts
// TODO Type safety with zod / validbot
// TODO Port to mutiple knowledge retrieval chain & expert agent with tools
// TODO Add Optional Mood extraction chain
// TODO Add heuristics
// TODO Add PythonLangChain FastAPI Wrapper

const default_question_generator_template = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question using the language addressed in by the user.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;

const default_qa_template = `Chat History:
{chat_history}

Use the chat history above and the following pieces of additional context knowledge to answer the question at the end in the language used. If you don't know the answer, just say that you don't know, don't try to make up an answer.

{context}

Question: {question}
Helpful Answer:`;

type KeywordGenerationInput = { active: boolean; k?: number };
type ExpertArgs = {
  roles?: { assistant?: PersonaRole; expert: PersonaRole };
  retrievalOpt?: { keywordGeneration?: KeywordGenerationInput };
  lang: Locale;
};

export interface ExpertRetrievalQAChainInput extends ChainInputs {
  retriever: BaseRetriever;
  combineDocumentsChain: BaseChain;
  questionGeneratorChain: LLMChain;
  returnSourceDocuments?: boolean;
  inputKey?: string;
  expertArgs?: ExpertArgs;
}

export class ExpertRetrievalQAChain
  extends BaseChain
  implements ExpertRetrievalQAChainInput
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

  returnSourceDocuments = true;

  assistant: PersonaRole = { name: "assistant" };

  expert: PersonaRole = { name: "expert" };

  keywordGeneration: KeywordGenerationInput = { active: true };

  constructor(fields: ExpertRetrievalQAChainInput) {
    super(fields);
    const { expertArgs } = fields;
    if (expertArgs) {
      const { roles } = expertArgs;
      const { retrievalOpt } = expertArgs;
      if (retrievalOpt) {
        const { keywordGeneration } = retrievalOpt;

        if (keywordGeneration) {
          const { active } = keywordGeneration;
          if (active) {
            this.keywordGeneration.active = keywordGeneration.active;
            const { k } = keywordGeneration;
            this.keywordGeneration.k = k;
          }
        }
      }
      if (roles) {
        const { expert } = roles;
        this.expert.name = expert.name;
        if (expert.description) this.expert.description = expert.description;
        if (expert.instruction) this.expert.instruction = expert.instruction;
        if (expert.mbti) this.expert.mbti = expert.mbti;
        if (expert.gptParams) this.expert.gptParams = expert.gptParams;
        if (expert.id) this.expert.id = expert.id;
        if (expert.initialGreeting)
          this.expert.initialGreeting = expert.initialGreeting;
        const { assistant } = roles;
        if (assistant) {
          this.assistant.name = assistant.name;
          if (assistant.description)
            this.assistant.description = assistant.description;
          if (assistant.instruction)
            this.assistant.instruction = assistant.instruction;
          if (assistant.mbti) this.assistant.mbti = assistant.mbti;
          if (assistant.gptParams)
            this.assistant.gptParams = assistant.gptParams;
          if (assistant.id) this.assistant.id = assistant.id;
          if (assistant.initialGreeting)
            this.assistant.initialGreeting = assistant.initialGreeting;
        }
      }
    }
    this.retriever = fields.retriever;
    this.combineDocumentsChain = fields.combineDocumentsChain;
    this.questionGeneratorChain = fields.questionGeneratorChain;
    this.inputKey = fields.inputKey ?? this.inputKey;

    this.returnSourceDocuments =
      fields.returnSourceDocuments ?? this.returnSourceDocuments;
  }

  // TODO add max token guardrails
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
    const chatHistory: string = ExpertRetrievalQAChain.getChatHistoryString(
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

  _chainType(): string {
    return "expert_retrieval_chain";
  }

  static async deserialize(
    _data: SerializedChatVectorDBQAChain,
    _values: LoadValues
  ): Promise<ExpertRetrievalQAChain> {
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
      /** @deprecated Pass in qaChainOptions.prompt instead */
      qaTemplate?: string;
      qaChainOptions?: QAChainParams;
      questionGeneratorChainOptions?: {
        llm?: BaseLanguageModel;
        template?: string;
      };
    } & Omit<
      ExpertRetrievalQAChainInput,
      "retriever" | "combineDocumentsChain" | "questionGeneratorChain"
    > = {}
  ): ExpertRetrievalQAChain {
    const {
      qaTemplate,
      expertArgs,
      qaChainOptions,
      questionGeneratorChainOptions,
      verbose,
      ...rest
    } = options;
    const expert = expertArgs?.roles?.expert;
    const lang = expertArgs?.lang;
    // TODO how to use string indexing ["en"]?
    const meyerBriggsTypesLocalized = meyerBriggsTypesDict.en;

    const qaPromptTemplate = `You are ${
      expert
        ? `${expert.name} ${
            expert.description ? expert.description : ``
          }. Your personality is best described by: ${
            expert.mbti
              ? `${meyerBriggsTypesLocalized[expert.mbti].name}. ${
                  meyerBriggsTypesLocalized[expert.mbti].description
                }`
              : `${meyerBriggsTypesLocalized.INFJ.name}. ${meyerBriggsTypesLocalized.INFJ.description}`
          }.`
        : `an expert best capable to answer the given question. Assume the respective role by introducing yourself with your Name, profession and field of expertise. Your personality is best described by: ${
            meyerBriggsTypesLocalized.INFJ.name
          }. ${meyerBriggsTypesLocalized.INFJ.description}.
    
    ${qaTemplate ? `${qaTemplate}` : default_qa_template}`
    }`;
    const qaChain = loadQAChain(llm, {
      prompt: PromptTemplate.fromTemplate(qaPromptTemplate),
      type: "stuff",
    });

    const questionGeneratorChainPrompt = PromptTemplate.fromTemplate(
      questionGeneratorChainOptions?.template ??
        default_question_generator_template
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
