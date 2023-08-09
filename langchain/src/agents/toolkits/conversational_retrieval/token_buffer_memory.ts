import { ChatOpenAI } from "../../../chat_models/openai.js";
import {
  InputValues,
  MemoryVariables,
  OutputValues,
  getBufferString,
  getInputValue,
  getOutputValue,
} from "../../../memory/base.js";
import {
  BaseChatMemory,
  BaseChatMemoryInput,
} from "../../../memory/chat_memory.js";
import { _formatIntermediateSteps } from "../../openai/index.js";

export type OpenAIAgentTokenBufferMemoryFields = BaseChatMemoryInput & {
  llm: ChatOpenAI;
  humanPrefix?: string;
  aiPrefix?: string;
  memoryKey?: string;
  maxTokenLimit?: number;
  returnMessages?: boolean;
  outputKey?: string;
  intermediateStepsKey?: string;
};

/**
 * Memory used to save agent output and intermediate steps.
 */
export class OpenAIAgentTokenBufferMemory extends BaseChatMemory {
  humanPrefix = "Human";

  aiPrefix = "AI";

  llm: ChatOpenAI;

  memoryKey = "history";

  maxTokenLimit = 12000;

  returnMessages = true;

  outputKey = "output";

  intermediateStepsKey = "intermediateSteps";

  constructor(fields: OpenAIAgentTokenBufferMemoryFields) {
    super(fields);
    this.humanPrefix = fields.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields.aiPrefix ?? this.aiPrefix;
    this.llm = fields.llm;
    this.memoryKey = fields.memoryKey ?? this.memoryKey;
    this.maxTokenLimit = fields.maxTokenLimit ?? this.maxTokenLimit;
    this.returnMessages = fields.returnMessages ?? this.returnMessages;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.intermediateStepsKey =
      fields.intermediateStepsKey ?? this.intermediateStepsKey;
  }

  get memoryKeys(): string[] {
    return [this.memoryKey];
  }

  async getMessages() {
    return this.chatHistory.getMessages();
  }

  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    const buffer = await this.getMessages();
    if (this.returnMessages) {
      return { [this.memoryKey]: buffer };
    } else {
      const bufferString = getBufferString(
        buffer,
        this.humanPrefix,
        this.aiPrefix
      );
      return { [this.memoryKey]: bufferString };
    }
  }

  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const inputValue = getInputValue(inputValues, this.inputKey);
    const outputValue = getOutputValue(outputValues, this.outputKey);
    await this.chatHistory.addUserMessage(inputValue);
    const intermediateStepMessages = _formatIntermediateSteps(
      outputValues[this.intermediateStepsKey]
    );
    for (const message of intermediateStepMessages) {
      await this.chatHistory.addMessage(message);
    }
    await this.chatHistory.addAIChatMessage(outputValue);
    const currentMessages = await this.chatHistory.getMessages();
    let tokenInfo = await this.llm.getNumTokensFromMessages(currentMessages);
    if (tokenInfo.totalCount > this.maxTokenLimit) {
      const prunedMemory = [];
      while (tokenInfo.totalCount > this.maxTokenLimit) {
        const retainedMessage = currentMessages.pop();
        if (!retainedMessage) {
          console.warn(
            `Could not prune enough messages from chat history to stay under ${this.maxTokenLimit} tokens.`
          );
          break;
        }
        prunedMemory.push(retainedMessage);
        tokenInfo = await this.llm.getNumTokensFromMessages(currentMessages);
      }
      await this.chatHistory.clear();
      for (const message of prunedMemory) {
        await this.chatHistory.addMessage(message);
      }
    }
  }
}
