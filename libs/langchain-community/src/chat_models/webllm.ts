import {
  SimpleChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BaseMessage, AIMessageChunk } from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import * as webllm from "@mlc-ai/web-llm";
import { ChatCompletionMessageParam } from "@mlc-ai/web-llm/lib/openai_api_protocols";

export interface WebLLMInputs extends BaseChatModelParams {
  appConfig?: webllm.AppConfig;
  chatOptions?: webllm.ChatOptions;
  temperature?: number;
  model: string;
}

export interface WebLLMCallOptions extends BaseLanguageModelCallOptions {}

/**
 * To use this model you need to have the `@mlc-ai/web-llm` module installed.
 * This can be installed using `npm install -S @mlc-ai/web-llm`.
 *
 * You can see a list of available model records here:
 * https://github.com/mlc-ai/web-llm/blob/main/src/config.ts
 * @example
 * ```typescript
 * // Initialize the ChatWebLLM model with the model record.
 * const model = new ChatWebLLM({
 *   model: "Phi-3-mini-4k-instruct-q4f16_1-MLC",
 *   chatOptions: {
 *     temperature: 0.5,
 *   },
 * });
 *
 * // Call the model with a message and await the response.
 * const response = await model.invoke([
 *   new HumanMessage({ content: "My name is John." }),
 * ]);
 * ```
 */
export class ChatWebLLM extends SimpleChatModel<WebLLMCallOptions> {
  static inputs: WebLLMInputs;

  protected engine: webllm.MLCEngine;

  appConfig?: webllm.AppConfig;

  chatOptions?: webllm.ChatOptions;

  temperature?: number;

  model: string;

  static lc_name() {
    return "ChatWebLLM";
  }

  constructor(inputs: WebLLMInputs) {
    super(inputs);
    this.appConfig = inputs.appConfig;
    this.chatOptions = inputs.chatOptions;
    this.model = inputs.model;
    this.temperature = inputs.temperature;
    this.engine = new webllm.MLCEngine();
  }

  _llmType() {
    return "web-llm";
  }

  async initialize(progressCallback?: webllm.InitProgressCallback) {
    if (progressCallback !== undefined) {
      this.engine.setInitProgressCallback(progressCallback);
    }
    await this.reload(this.model, this.chatOptions, this.appConfig);
  }

  async reload(
    modelId: string,
    newChatOpts?: webllm.ChatOptions,
    newAppConfig?: webllm.AppConfig
  ) {
    await this.engine.reload(modelId, newChatOpts, newAppConfig);
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const messagesInput: ChatCompletionMessageParam[] = messages.map(
      (message) => {
        if (typeof message.content !== "string") {
          throw new Error(
            "ChatWebLLM does not support non-string message content in sessions."
          );
        }
        const langChainType = message._getType();
        let role;
        if (langChainType === "ai") {
          role = "assistant" as const;
        } else if (langChainType === "human") {
          role = "user" as const;
        } else if (langChainType === "system") {
          role = "system" as const;
        } else {
          throw new Error(
            "Function, tool, and generic messages are not supported."
          );
        }
        return {
          role,
          content: message.content,
        };
      }
    );

    const stream = await this.engine.chat.completions.create({
      stream: true,
      messages: messagesInput,
      stop: options.stop,
      logprobs: true,
    });
    for await (const chunk of stream) {
      // Last chunk has undefined content
      const text = chunk.choices[0].delta.content ?? "";
      yield new ChatGenerationChunk({
        text,
        message: new AIMessageChunk({
          content: text,
          additional_kwargs: {
            logprobs: chunk.choices[0].logprobs,
            finish_reason: chunk.choices[0].finish_reason,
          },
        }),
      });
      await runManager?.handleLLMNewToken(text);
    }
  }

  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const chunks = [];
    for await (const chunk of this._streamResponseChunks(
      messages,
      options,
      runManager
    )) {
      chunks.push(chunk.text);
    }
    return chunks.join("");
  }
}
