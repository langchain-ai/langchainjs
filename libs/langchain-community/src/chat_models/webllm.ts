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

// Code from jacoblee93 https://github.com/jacoblee93/fully-local-pdf-chatbot/blob/main/app/lib/chat_models/webllm.ts

export interface WebLLMInputs extends BaseChatModelParams {
  appConfig?: webllm.AppConfig;
  chatOpts?: webllm.ChatOptions;
  modelRecord: webllm.ModelRecord;
}

export interface WebLLMCallOptions extends BaseLanguageModelCallOptions {}

export class ChatWebLLM extends SimpleChatModel<WebLLMCallOptions> {
  static inputs: WebLLMInputs;

  protected engine: webllm.EngineInterface;

  appConfig?: webllm.AppConfig;

  chatOpts?: webllm.ChatOptions;

  modelRecord: webllm.ModelRecord;

  static lc_name() {
    return "ChatWebLLM";
  }

  constructor(inputs: WebLLMInputs) {
    super(inputs);
    this.appConfig = inputs.appConfig;
    this.chatOpts = inputs.chatOpts;
    this.modelRecord = inputs.modelRecord;
  }

  _llmType() {
    return this.modelRecord.model_id;
  }

  async initialize() {
    this.engine = webllm
      .Engine()
      .reload(this.modelRecord.model_id, this.appConfig, this.chatOpts);
    this.engine.setInitProgressCallback(() => {});
  }

  async reload(
    newModelRecord: webllm.ModelRecord,
    newAppConfig?: webllm.AppConfig,
    newChatOpts?: webllm.ChatOptions
  ) {
    if (this.engine !== undefined) {
      this.engine.reload(newModelRecord.model_id, newAppConfig, newChatOpts);
    } else throw new Error("Initialize model before reloading.");
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    await this.initialize();

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

    const stream = this.engine.chat.completions.create({
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
      await runManager?.handleLLMNewToken(text ?? "");
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
