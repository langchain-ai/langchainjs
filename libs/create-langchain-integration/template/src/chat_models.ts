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

// Uncomment if implementing tool calling

// import {
//   type BindToolsInput,
// } from "@langchain/core/language_models/chat_models";

/**
 * Input to chat model class.
 */
export interface ChatIntegrationInput extends BaseChatModelParams {}

/**
 * Integration with a chat model.
 */
export class ChatIntegration
  // Extend BaseLanguageModelCallOptions and pass it as the generic here
  // to support typing for additional runtime parameters for your integration
  extends SimpleChatModel<BaseLanguageModelCallOptions>
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

  /**
   * Implement to support tool calling.
   * You must also pass the bound tools into your actual chat completion call.
   * See {@link ../../langchain-cerberas/src/chat_model.ts} for
   * an example.
   */
  // override bindTools(
  //   tools: BindToolsInput[],
  //   kwargs?: Partial<this["ParsedCallOptions"]>
  // ): Runnable<BaseLanguageModelInput, AIMessageChunk, BaseLanguageModelCallOptions> {
  //   return this.withConfig({
  //     tools: tools.map((tool) => convertToIntegrationFormat(tool)),
  //     ...kwargs,
  //   });
  // }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
