import { type BaseMessage } from "@langchain/core/messages";
import { type BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  SimpleChatModel,
} from "@langchain/core/language_models/chat_models";

// Uncomment if implementing streaming

// import {
//   ChatGenerationChunk,
// } from "@langchain/core/outputs";
// import {
//   AIMessageChunk,
// } from "@langchain/core/messages";

/**
 * Input to chat model class.
 */
export interface ChatIntegrationInput extends BaseChatModelParams {}

/**
 * Integration with a chat model.
 */
export class ChatIntegration<
    CallOptions extends BaseLanguageModelCallOptions = BaseLanguageModelCallOptions
  >
  extends SimpleChatModel<CallOptions>
  implements ChatIntegrationInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatIntegration";
  }

  lc_serializable = true;

  /**
   * Replace with any secrets this class passes to `super`.
   * See {@link ../../langchain-cohere/src/chat_model.ts} for
   * an example.
   */
  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "API_KEY_NAME",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "API_KEY_NAME",
    };
  }

  constructor(fields?: ChatIntegrationInput) {
    super(fields ?? {});
  }

  // Replace
  _llmType() {
    return "chat_integration";
  }

  /**
   * For some given input messages and options, return a string output.
   */
  _call(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    throw new Error("Not implemented.");
  }

  /**
   * Implement to support streaming.
   * Should yield chunks iteratively.
   */
  // async *_streamResponseChunks(
  //   messages: BaseMessage[],
  //   options: this["ParsedCallOptions"],
  //   runManager?: CallbackManagerForLLMRun
  // ): AsyncGenerator<ChatGenerationChunk> {
  //   // All models have a built in `this.caller` property for retries
  //   const stream = await this.caller.call(async () =>
  //     createStreamMethod()
  //   );
  //   for await (const chunk of stream) {
  //     if (!chunk.done) {
  //       yield new ChatGenerationChunk({
  //         text: chunk.response,
  //         message: new AIMessageChunk({ content: chunk.response }),
  //       });
  //       await runManager?.handleLLMNewToken(chunk.response ?? "");
  //     }
  //   }
  // }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
