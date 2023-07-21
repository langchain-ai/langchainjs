import {
  getBufferString,
  InputValues,
  MemoryVariables,
  OutputValues,
} from "./base.js";
import { SummarizerMixin, SummarizerMixinInput } from "./summary.js";

export interface ConversationSummaryBufferMemoryInput
  extends SummarizerMixinInput {
  max_token_limit?: number;
}

export class ConversationSummaryBufferMemory
  extends SummarizerMixin
  implements ConversationSummaryBufferMemoryInput
{
  moving_summary_buffer = "";

  max_token_limit = 2000;

  constructor(fields: ConversationSummaryBufferMemoryInput) {
    super(fields);

    this.max_token_limit = fields?.max_token_limit ?? this.max_token_limit;
  }

  get memoryKeys() {
    return [this.memoryKey];
  }

  async loadMemoryVariables(_: InputValues): Promise<MemoryVariables> {
    let buffer = await this.chatHistory.getMessages();
    if (this.moving_summary_buffer) {
      buffer = [
        new this.summaryChatMessageClass(this.moving_summary_buffer),
        ...buffer,
      ];
    }

    let final_buffer;
    if (this.returnMessages) {
      final_buffer = buffer;
    } else {
      final_buffer = getBufferString(buffer, this.humanPrefix, this.aiPrefix);
    }

    return { [this.memoryKey]: final_buffer };
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
    if (this.moving_summary_buffer) {
      buffer = [
        new this.summaryChatMessageClass(this.moving_summary_buffer),
        ...buffer,
      ];
    }

    // 判断 this.llm 是否有getNumTokensFromMessages方法
    let currBufferLength;
    if (this.returnMessages) {
      currBufferLength = (await this.llm.getNumTokensFromMessages(buffer))
        .totalCount;
    } else {
      currBufferLength = await this.llm.getNumTokens(
        getBufferString(buffer, this.humanPrefix, this.aiPrefix)
      );
    }

    if (currBufferLength > this.max_token_limit) {
      const prunedMemory = [];
      while (currBufferLength > this.max_token_limit) {
        const poppedMessage = buffer.shift();
        if (poppedMessage) {
          prunedMemory.push(poppedMessage); // replace YourMessageType with the actual type of message
          if (this.returnMessages) {
            currBufferLength = (await this.llm.getNumTokensFromMessages(buffer))
              .totalCount;
          } else {
            currBufferLength = await this.llm.getNumTokens(
              getBufferString(buffer, this.humanPrefix, this.aiPrefix)
            );
          }
        }
      }
      this.moving_summary_buffer = await this.predictNewSummary(
        prunedMemory,
        this.moving_summary_buffer
      );
    }
  }

  async clear() {
    await super.clear();
    this.moving_summary_buffer = "";
  }
}
