import {
  SimpleChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BaseMessage, AIMessageChunk } from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import * as webllm from '@mlc-ai/web-llm'
import { ChatCompletionMessageParam } from '@mlc-ai/web-llm/lib/openai_api_protocols'

// Code from jacoblee93 https://github.com/jacoblee93/fully-local-pdf-chatbot/blob/main/app/lib/chat_models/webllm.ts

/**
 * Note that the modelPath is the only required parameter. For testing you
 * can set this in the environment variable `LLAMA_PATH`.
 */
export interface WebLLMInputs extends BaseChatModelParams {
  appConfig?: webllm.AppConfig;
  chatOpts?: webllm.ChatOptions;
  modelRecord: webllm.ModelRecord;
  temperature?: number;
}

export interface WebLLMCallOptions extends BaseLanguageModelCallOptions {}

/**
 *  To use this model you need to have the `@mlc-ai/web-llm` module installed.
 *  This can be installed using `npm install -S @mlc-ai/web-llm`
 * @example
 * ```typescript
 * // Initialize the ChatWebLLM model with the model record and chat options.
 * // Note that if the appConfig field is set, the list of model records 
 * // must include the selected model record for the engine.
 * const model = new ChatWebLLM({
 *   modelRecord: {
 *     "model_url": "https://huggingface.co/mlc-ai/Llama-3-8B-Instruct-q4f32_1-MLC/resolve/main/",
 *     "model_id": "Llama-3-8B-Instruct-q4f32_1",
 *     "model_lib_url": webllm.modelLibURLPrefix + webllm.modelVersion + "/Llama-3-8B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm,
 *   },
 *   chatOpts: {
 *     temperature: 0.5,
 *     top-p: 2
 *   }
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

  protected engine: webllm.EngineInterface;

  /**
   * Configures list of models available to engine via list of ModelRecords.
   * @example
   */
  // const appConfig: webllm.AppConfig = {
  //   model_list: [
  //     {
  //       "model_url": "https://huggingface.co/mlc-ai/Llama-3-8B-Instruct-q4f32_1-MLC/resolve/main/",
  //       "model_id": "Llama-3-8B-Instruct-q4f32_1",
  //       "model_lib_url": webllm.modelLibURLPrefix + webllm.modelVersion + "/Llama-3-8B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
  //     },
  //   ]
  // };
  appConfig?: webllm.AppConfig;

  /**
   * Configures model options (temperature, etc.).
   */
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
    return "ChatWebLLM: " + this.modelRecord.model_id
  }

  async initialize() {
    this.engine = webllm.Engine().reload(this.modelRecord.model_id, this.appConfig, this.chatOpts)
    this.engine.setInitProgressCallback(() => {})
  }

  async reload(newModelRecord: webllm.ModelRecord, newAppConfig?: webllm.AppConfig, newChatOpts?: webllm.ChatOptions) {
    if (this.engine !== undefined) {
      this.engine.reload(newModelRecord.model_id, newAppConfig, newChatOpts)
    } else throw new Error("Initialize model before reloading.")
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    await this.initialize();

    const messagesInput: ChatCompletionMessageParam[] = messages.map(
      (message) => {
        if (typeof message.content !== "string") {
          throw new Error(
            "ChatWebLLM does not support non-string message content in sessions.",
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
            "Function, tool, and generic messages are not supported.",
          );
        }
        return {
          role,
          content: message.content,
        };
      },
    );
    
    const stream = this.engine.chat.completions.create(
      {
        stream: true,
        messages: messagesInput,
        stop: options.stop,
        logprobs: true
      }
    );
    for await (const chunk of stream) {
      // Last chunk has undefined content
      const text = chunk.choices[0].delta.content ?? "";
      yield new ChatGenerationChunk({
        text,
        message: new AIMessageChunk({
          content: text,
          additional_kwargs: {
            logprobs: chunk.choices[0].logprobs,
            finish_reason: chunk.choices[0].finish_reason
          },
        }),
      });
      await runManager?.handleLLMNewToken(text ?? "");
    }
  }

  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<string> {
    const chunks = [];
    for await (const chunk of this._streamResponseChunks(
      messages,
      options,
      runManager,
    )) {
      chunks.push(chunk.text);
    }
    return chunks.join("");
  }
}