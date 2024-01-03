import {
  SimpleChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";

export interface CustomChatModelInput extends BaseChatModelParams {
  n: number;
}

export class CustomChatModel extends SimpleChatModel {
  n: number;

  constructor(fields: CustomChatModelInput) {
    super(fields);
    this.n = fields.n;
  }

  _llmType() {
    return "custom";
  }

  async _call(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    if (!messages.length) {
      throw new Error("No messages provided.");
    }
    if (typeof messages[0].content !== "string") {
      throw new Error("Multimodal messages are not supported.");
    }
    return messages[0].content.slice(0, this.n);
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    if (!messages.length) {
      throw new Error("No messages provided.");
    }
    if (typeof messages[0].content !== "string") {
      throw new Error("Multimodal messages are not supported.");
    }
    for (const letter of messages[0].content.slice(0, this.n)) {
      yield new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: letter,
        }),
        text: letter,
      });
      await runManager?.handleLLMNewToken(letter);
    }
  }

  _combineLLMOutput() {
    return {};
  }
}

const chatModel = new CustomChatModel({ n: 4 });
console.log(await chatModel.invoke([["human", "I am an LLM"]]));

const stream = await chatModel.stream([["human", "I am an LLM"]]);
for await (const chunk of stream) {
  console.log(chunk);
}
