import { BaseChain, ChainValues } from "../base.js";
import { BaseChatModel, ChatMessage, Role } from "../../chat_models/base.js";
import { ChatMemory } from "../../memory/chat_memory.js";
import { BasePromptTemplate } from "../../prompts/index.js";
import { Document } from "../../document.js";

export interface ChatChainInput {
  humanPrefix: Role;
  aiPrefix: Role;
}

function getDefaultStartMessages() {
  return [
    {
      role: "system",
      text: `You are chatbot optimized for question answering.
        Your job is to answer the most recent user question based
        ONLY on the information they have told you before.
        Do NOT use other information than what is provided in previous
        messages by the human.`,
    },
  ];
}

export class ChatQAChain extends BaseChain implements ChatChainInput {
  humanPrefix: Role = "user";

  aiPrefix: Role = "assistant";

  memory: ChatMemory; // TODO: consolidate chatmemory with base memory

  model: BaseChatModel;

  prompt: BasePromptTemplate;

  questionKey = "question";

  documentsKey = "input_documents";

  outputKey = "response";

  starterMessages: ChatMessage[] = [];

  get inputKeys() {
    return [this.questionKey, this.documentsKey];
  }

  get outputKeys() {
    return [this.outputKey];
  }

  constructor(fields: {
    model: BaseChatModel;
    prompt: BasePromptTemplate;
    humanPrefix?: Role;
    aiPrefix?: Role;
    startMessages?: ChatMessage[];
  }) {
    super();
    this.model = fields.model;
    this.prompt = fields.prompt;
    this.humanPrefix = fields.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields.aiPrefix ?? this.aiPrefix;
    this.starterMessages = fields.startMessages ?? getDefaultStartMessages();
  }

  static fromModel(model: BaseChatModel, prompt: BasePromptTemplate) {
    return new ChatQAChain({ model, prompt });
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    const newMessage: ChatMessage = {
      role: this.humanPrefix,
      text: values[this.questionKey],
    };
    const docs = values[this.documentsKey];
    const docMessages: ChatMessage[] = docs.map((doc: Document) => ({
      role: this.humanPrefix,
      text: doc.pageContent,
    }));
    const messages = [...this.starterMessages, ...docMessages, newMessage];
    const output = await this.model.run(messages);
    return { [this.outputKey]: output };
  }
}
