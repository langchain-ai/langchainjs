import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import {
  SimpleChatModel,
  type BaseChatModelParams,
  LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
} from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import type { StringWithAutocomplete } from "@langchain/core/utils/types";

import {
  createOllamaChatStream,
  createOllamaGenerateStream,
  type OllamaInput,
  type OllamaMessage,
} from "../utils/ollama.js";

/**
 * @deprecated Deprecated in favor of the `@langchain/ollama` package. Import from `@langchain/ollama` instead.
 */
export interface ChatOllamaInput extends OllamaInput {}

/**
 * @deprecated Deprecated in favor of the `@langchain/ollama` package. Import from `@langchain/ollama` instead.
 */
export interface ChatOllamaCallOptions extends BaseLanguageModelCallOptions {}

/**
 * @deprecated Deprecated in favor of the `@langchain/ollama` package. Import from `@langchain/ollama` instead.
 *
 * A class that enables calls to the Ollama API to access large language
 * models in a chat-like fashion. It extends the SimpleChatModel class and
 * implements the OllamaInput interface.
 * @example
 * ```typescript
 * const prompt = ChatPromptTemplate.fromMessages([
 *   [
 *     "system",
 *     `You are an expert translator. Format all responses as JSON objects with two keys: "original" and "translated".`,
 *   ],
 *   ["human", `Translate "{input}" into {language}.`],
 * ]);
 *
 * const model = new ChatOllama({
 *   baseUrl: "http://api.example.com",
 *   model: "llama2",
 *   format: "json",
 * });
 *
 * const chain = prompt.pipe(model);
 *
 * const result = await chain.invoke({
 *   input: "I love programming",
 *   language: "German",
 * });
 *
 * ```
 */
export class ChatOllama
  extends SimpleChatModel<ChatOllamaCallOptions>
  implements ChatOllamaInput
{
  static lc_name() {
    return "ChatOllama";
  }

  lc_serializable = true;

  model = "llama2";

  baseUrl = "http://localhost:11434";

  keepAlive = "5m";

  embeddingOnly?: boolean;

  f16KV?: boolean;

  frequencyPenalty?: number;

  headers?: Record<string, string>;

  logitsAll?: boolean;

  lowVram?: boolean;

  mainGpu?: number;

  mirostat?: number;

  mirostatEta?: number;

  mirostatTau?: number;

  numBatch?: number;

  numCtx?: number;

  numGpu?: number;

  numGqa?: number;

  numKeep?: number;

  numPredict?: number;

  numThread?: number;

  penalizeNewline?: boolean;

  presencePenalty?: number;

  repeatLastN?: number;

  repeatPenalty?: number;

  ropeFrequencyBase?: number;

  ropeFrequencyScale?: number;

  temperature?: number;

  stop?: string[];

  tfsZ?: number;

  topK?: number;

  topP?: number;

  typicalP?: number;

  useMLock?: boolean;

  useMMap?: boolean;

  vocabOnly?: boolean;

  format?: StringWithAutocomplete<"json">;

  constructor(fields: OllamaInput & BaseChatModelParams) {
    super(fields);
    this.model = fields.model ?? this.model;
    this.baseUrl = fields.baseUrl?.endsWith("/")
      ? fields.baseUrl.slice(0, -1)
      : fields.baseUrl ?? this.baseUrl;
    this.keepAlive = fields.keepAlive ?? this.keepAlive;
    this.embeddingOnly = fields.embeddingOnly;
    this.f16KV = fields.f16KV;
    this.frequencyPenalty = fields.frequencyPenalty;
    this.headers = fields.headers;
    this.logitsAll = fields.logitsAll;
    this.lowVram = fields.lowVram;
    this.mainGpu = fields.mainGpu;
    this.mirostat = fields.mirostat;
    this.mirostatEta = fields.mirostatEta;
    this.mirostatTau = fields.mirostatTau;
    this.numBatch = fields.numBatch;
    this.numCtx = fields.numCtx;
    this.numGpu = fields.numGpu;
    this.numGqa = fields.numGqa;
    this.numKeep = fields.numKeep;
    this.numPredict = fields.numPredict;
    this.numThread = fields.numThread;
    this.penalizeNewline = fields.penalizeNewline;
    this.presencePenalty = fields.presencePenalty;
    this.repeatLastN = fields.repeatLastN;
    this.repeatPenalty = fields.repeatPenalty;
    this.ropeFrequencyBase = fields.ropeFrequencyBase;
    this.ropeFrequencyScale = fields.ropeFrequencyScale;
    this.temperature = fields.temperature;
    this.stop = fields.stop;
    this.tfsZ = fields.tfsZ;
    this.topK = fields.topK;
    this.topP = fields.topP;
    this.typicalP = fields.typicalP;
    this.useMLock = fields.useMLock;
    this.useMMap = fields.useMMap;
    this.vocabOnly = fields.vocabOnly;
    this.format = fields.format;
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "ollama",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: this.temperature ?? undefined,
      ls_stop: this.stop,
      ls_max_tokens: params.options.num_predict,
    };
  }

  _llmType() {
    return "ollama";
  }

  /**
   * A method that returns the parameters for an Ollama API call. It
   * includes model and options parameters.
   * @param options Optional parsed call options.
   * @returns An object containing the parameters for an Ollama API call.
   */
  invocationParams(options?: this["ParsedCallOptions"]) {
    return {
      model: this.model,
      format: this.format,
      keep_alive: this.keepAlive,
      options: {
        embedding_only: this.embeddingOnly,
        f16_kv: this.f16KV,
        frequency_penalty: this.frequencyPenalty,
        logits_all: this.logitsAll,
        low_vram: this.lowVram,
        main_gpu: this.mainGpu,
        mirostat: this.mirostat,
        mirostat_eta: this.mirostatEta,
        mirostat_tau: this.mirostatTau,
        num_batch: this.numBatch,
        num_ctx: this.numCtx,
        num_gpu: this.numGpu,
        num_gqa: this.numGqa,
        num_keep: this.numKeep,
        num_predict: this.numPredict,
        num_thread: this.numThread,
        penalize_newline: this.penalizeNewline,
        presence_penalty: this.presencePenalty,
        repeat_last_n: this.repeatLastN,
        repeat_penalty: this.repeatPenalty,
        rope_frequency_base: this.ropeFrequencyBase,
        rope_frequency_scale: this.ropeFrequencyScale,
        temperature: this.temperature,
        stop: options?.stop ?? this.stop,
        tfs_z: this.tfsZ,
        top_k: this.topK,
        top_p: this.topP,
        typical_p: this.typicalP,
        use_mlock: this.useMLock,
        use_mmap: this.useMMap,
        vocab_only: this.vocabOnly,
      },
    };
  }

  _combineLLMOutput() {
    return {};
  }

  /** @deprecated */
  async *_streamResponseChunksLegacy(
    input: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const stream = createOllamaGenerateStream(
      this.baseUrl,
      {
        ...this.invocationParams(options),
        prompt: this._formatMessagesAsPrompt(input),
      },
      {
        ...options,
        headers: this.headers,
      }
    );
    for await (const chunk of stream) {
      if (!chunk.done) {
        yield new ChatGenerationChunk({
          text: chunk.response,
          message: new AIMessageChunk({ content: chunk.response }),
        });
        await runManager?.handleLLMNewToken(chunk.response ?? "");
      } else {
        yield new ChatGenerationChunk({
          text: "",
          message: new AIMessageChunk({ content: "" }),
          generationInfo: {
            model: chunk.model,
            total_duration: chunk.total_duration,
            load_duration: chunk.load_duration,
            prompt_eval_count: chunk.prompt_eval_count,
            prompt_eval_duration: chunk.prompt_eval_duration,
            eval_count: chunk.eval_count,
            eval_duration: chunk.eval_duration,
          },
        });
      }
    }
  }

  async *_streamResponseChunks(
    input: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    try {
      const stream = await this.caller.call(async () =>
        createOllamaChatStream(
          this.baseUrl,
          {
            ...this.invocationParams(options),
            messages: this._convertMessagesToOllamaMessages(input),
          },
          {
            ...options,
            headers: this.headers,
          }
        )
      );
      for await (const chunk of stream) {
        if (!chunk.done) {
          yield new ChatGenerationChunk({
            text: chunk.message.content,
            message: new AIMessageChunk({ content: chunk.message.content }),
          });
          await runManager?.handleLLMNewToken(chunk.message.content ?? "");
        } else {
          yield new ChatGenerationChunk({
            text: "",
            message: new AIMessageChunk({ content: "" }),
            generationInfo: {
              model: chunk.model,
              total_duration: chunk.total_duration,
              load_duration: chunk.load_duration,
              prompt_eval_count: chunk.prompt_eval_count,
              prompt_eval_duration: chunk.prompt_eval_duration,
              eval_count: chunk.eval_count,
              eval_duration: chunk.eval_duration,
            },
          });
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e.response?.status === 404) {
        console.warn(
          "[WARNING]: It seems you are using a legacy version of Ollama. Please upgrade to a newer version for better chat support."
        );
        yield* this._streamResponseChunksLegacy(input, options, runManager);
      } else {
        throw e;
      }
    }
  }

  protected _convertMessagesToOllamaMessages(
    messages: BaseMessage[]
  ): OllamaMessage[] {
    return messages.map((message) => {
      let role;
      if (message._getType() === "human") {
        role = "user";
      } else if (message._getType() === "ai") {
        role = "assistant";
      } else if (message._getType() === "system") {
        role = "system";
      } else {
        throw new Error(
          `Unsupported message type for Ollama: ${message._getType()}`
        );
      }
      let content = "";
      const images = [];
      if (typeof message.content === "string") {
        content = message.content;
      } else {
        for (const contentPart of message.content) {
          if (contentPart.type === "text") {
            content = `${content}\n${contentPart.text}`;
          } else if (
            contentPart.type === "image_url" &&
            typeof contentPart.image_url === "string"
          ) {
            const imageUrlComponents = contentPart.image_url.split(",");
            // Support both data:image/jpeg;base64,<image> format as well
            images.push(imageUrlComponents[1] ?? imageUrlComponents[0]);
          } else {
            throw new Error(
              `Unsupported message content type. Must either have type "text" or type "image_url" with a string "image_url" field.`
            );
          }
        }
      }
      return {
        role,
        content,
        images,
      };
    });
  }

  /** @deprecated */
  protected _formatMessagesAsPrompt(messages: BaseMessage[]): string {
    const formattedMessages = messages
      .map((message) => {
        let messageText;
        if (message._getType() === "human") {
          messageText = `[INST] ${message.content} [/INST]`;
        } else if (message._getType() === "ai") {
          messageText = message.content;
        } else if (message._getType() === "system") {
          messageText = `<<SYS>> ${message.content} <</SYS>>`;
        } else if (ChatMessage.isInstance(message)) {
          messageText = `\n\n${message.role[0].toUpperCase()}${message.role.slice(
            1
          )}: ${message.content}`;
        } else {
          console.warn(
            `Unsupported message type passed to Ollama: "${message._getType()}"`
          );
          messageText = "";
        }
        return messageText;
      })
      .join("\n");
    return formattedMessages;
  }

  /** @ignore */
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
      chunks.push(chunk.message.content);
    }
    return chunks.join("");
  }
}
