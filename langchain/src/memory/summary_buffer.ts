import {
  getBufferString,
  InputValues,
  MemoryVariables,
  OutputValues,
} from "./base.js";
import {
  BaseConversationSummaryMemory,
  BaseConversationSummaryMemoryInput,
} from "./summary.js";

export interface ConversationSummaryBufferMemoryInput
  extends BaseConversationSummaryMemoryInput {
  maxTokenLimit?: number;
}

export class ConversationSummaryBufferMemory
  extends BaseConversationSummaryMemory
  implements ConversationSummaryBufferMemoryInput
{
  movingSummaryBuffer = "";

  maxTokenLimit = 2000;

  constructor(fields: ConversationSummaryBufferMemoryInput) {
    super(fields);

    this.maxTokenLimit = fields?.maxTokenLimit ?? this.maxTokenLimit;
  }

  get memoryKeys() {
    return [this.memoryKey];
  }

  async loadMemoryVariables(_: InputValues): Promise<MemoryVariables> {
    let buffer = await this.chatHistory.getMessages();
    if (this.movingSummaryBuffer) {
      buffer = [
        new this.summaryChatMessageClass(this.movingSummaryBuffer),
        ...buffer,
      ];
    }

    let finalBuffer;
    if (this.returnMessages) {
      finalBuffer = buffer;
    } else {
      finalBuffer = getBufferString(buffer, this.humanPrefix, this.aiPrefix);
    }

    return { [this.memoryKey]: finalBuffer };
  }

  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    await super.saveContext(inputValues, outputValues);
    await this.prune();
  }

  async prune() {
    // Prune buffer if it exceeds max token limit
    let buffer = await this.chatHistory.getMessages();
    if (this.movingSummaryBuffer) {
      buffer = [
        new this.summaryChatMessageClass(this.movingSummaryBuffer),
        ...buffer,
      ];
    }

    let currBufferLength = await this.llm.getNumTokens(
      getBufferString(buffer, this.humanPrefix, this.aiPrefix)
    );

    if (currBufferLength > this.maxTokenLimit) {
      const prunedMemory = [];
      while (currBufferLength > this.maxTokenLimit) {
        const poppedMessage = buffer.shift();
        if (poppedMessage) {
          prunedMemory.push(poppedMessage);
          currBufferLength = await this.llm.getNumTokens(
            getBufferString(buffer, this.humanPrefix, this.aiPrefix)
          );
        }
      }
      this.movingSummaryBuffer = await this.predictNewSummary(
        prunedMemory,
        this.movingSummaryBuffer
      );
    }
  }

  async clear() {
    await super.clear();
    this.movingSummaryBuffer = "";
  }
}
