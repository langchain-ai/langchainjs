import {
  AIMessage,
  MessageContentText,
  UsageMetadata,
  type BaseMessage,
} from "@langchain/core/messages";
import { type BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  BaseChatModel,
  LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import { Ollama } from "ollama/browser";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { AIMessageChunk } from "@langchain/core/messages";
import type {
  ChatRequest as OllamaChatRequest,
  ChatResponse as OllamaChatResponse,
  Message as OllamaMessage,
} from "ollama";

function extractBase64FromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:.*?;base64,(.*)$/);
  return match ? match[1] : "";
}

function convertToOllamaMessages(messages: BaseMessage[]): OllamaMessage[] {
  return messages.flatMap((msg) => {
    if (["human", "generic"].includes(msg._getType())) {
      if (typeof msg.content === "string") {
        return {
          role: "user",
          content: msg.content,
        };
      }
      return msg.content.map((c) => {
        if (c.type === "text") {
          return {
            role: "user",
            content: c.text,
          };
        } else if (c.type === "image_url") {
          if (typeof c.image_url === "string") {
            return {
              role: "user",
              content: "",
              images: [extractBase64FromDataUrl(c.image_url)],
            };
          } else if (c.image_url.url && typeof c.image_url.url === "string") {
            return {
              role: "user",
              content: "",
              images: [extractBase64FromDataUrl(c.image_url.url)],
            };
          }
        }
        throw new Error(`Unsupported content type: ${c.type}`);
      });
    } else if (msg._getType() === "ai") {
      if (typeof msg.content === "string") {
        return {
          role: "assistant",
          content: msg.content,
        };
      } else if (
        msg.content.every(
          (c) => c.type === "text" && typeof c.text === "string"
        )
      ) {
        return (msg.content as MessageContentText[]).map((c) => ({
          role: "assistant",
          content: c.text,
        }));
      } else {
        throw new Error(
          `Unsupported content type(s): ${msg.content
            .map((c) => c.type)
            .join(", ")}`
        );
      }
    } else if (msg._getType() === "system") {
      if (typeof msg.content === "string") {
        return {
          role: "system",
          content: msg.content,
        };
      } else if (
        msg.content.every(
          (c) => c.type === "text" && typeof c.text === "string"
        )
      ) {
        return (msg.content as MessageContentText[]).map((c) => ({
          role: "system",
          content: c.text,
        }));
      } else {
        throw new Error(
          `Unsupported content type(s): ${msg.content
            .map((c) => c.type)
            .join(", ")}`
        );
      }
    } else {
      throw new Error(`Unsupported message type: ${msg._getType()}`);
    }
  });
}

export interface ChatOllamaCallOptions extends BaseLanguageModelCallOptions {
  /**
   * An array of strings to stop on.
   */
  stop?: string[];
}

export interface PullModelOptions {
  /**
   * Whether or not to stream the download.
   * @default true
   */
  stream?: boolean;
  insecure?: boolean;
  /**
   * Whether or not to log the status of the download
   * to the console.
   * @default false
   */
  logProgress?: boolean;
}

/**
 * Input to chat model class.
 */
export interface ChatOllamaInput extends BaseChatModelParams {
  /**
   * The model to invoke. If the model does not exist, it
   * will be pulled.
   * @default "llama3"
   */
  model?: string;
  /**
   * The host URL of the Ollama server.
   */
  baseUrl?: string;
  /**
   * Whether or not to check the model exists on the local machine before
   * invoking it. If set to `true`, the model will be pulled if it does not
   * exist.
   * @default false
   */
  checkOrPullModel?: boolean;
  streaming?: boolean;
  numa?: boolean;
  numCtx?: number;
  numBatch?: number;
  numGpu?: number;
  mainGpu?: number;
  lowVram?: boolean;
  f16Kv?: boolean;
  logitsAll?: boolean;
  vocabOnly?: boolean;
  useMmap?: boolean;
  useMlock?: boolean;
  embeddingOnly?: boolean;
  numThread?: number;
  numKeep?: number;
  seed?: number;
  numPredict?: number;
  topK?: number;
  topP?: number;
  tfsZ?: number;
  typicalP?: number;
  repeatLastN?: number;
  temperature?: number;
  repeatPenalty?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  mirostat?: number;
  mirostatTau?: number;
  mirostatEta?: number;
  penalizeNewline?: boolean;
  format?: string;
  /**
   * @default "5m"
   */
  keepAlive?: string | number;
}

/**
 * Integration with the Ollama SDK.
 *
 * @example
 * ```typescript
 * import { ChatOllama } from "@langchain/ollama";
 *
 * const model = new ChatOllama({
 *   model: "llama3", // Default model.
 * });
 *
 * const result = await model.invoke([
 *   "human",
 *   "What is a good name for a company that makes colorful socks?",
 * ]);
 * console.log(result);
 * ```
 */
export class ChatOllama
  extends BaseChatModel<ChatOllamaCallOptions, AIMessageChunk>
  implements ChatOllamaInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatOllama";
  }

  model = "llama3";

  numa?: boolean;

  numCtx?: number;

  numBatch?: number;

  numGpu?: number;

  mainGpu?: number;

  lowVram?: boolean;

  f16Kv?: boolean;

  logitsAll?: boolean;

  vocabOnly?: boolean;

  useMmap?: boolean;

  useMlock?: boolean;

  embeddingOnly?: boolean;

  numThread?: number;

  numKeep?: number;

  seed?: number;

  numPredict?: number;

  topK?: number;

  topP?: number;

  tfsZ?: number;

  typicalP?: number;

  repeatLastN?: number;

  temperature?: number;

  repeatPenalty?: number;

  presencePenalty?: number;

  frequencyPenalty?: number;

  mirostat?: number;

  mirostatTau?: number;

  mirostatEta?: number;

  penalizeNewline?: boolean;

  streaming?: boolean;

  format?: string;

  keepAlive?: string | number = "5m";

  client: Ollama;

  checkOrPullModel = false;

  constructor(fields?: ChatOllamaInput) {
    super(fields ?? {});

    this.client = new Ollama({
      host: fields?.baseUrl,
    });

    this.model = fields?.model ?? this.model;
    this.numa = fields?.numa;
    this.numCtx = fields?.numCtx;
    this.numBatch = fields?.numBatch;
    this.numGpu = fields?.numGpu;
    this.mainGpu = fields?.mainGpu;
    this.lowVram = fields?.lowVram;
    this.f16Kv = fields?.f16Kv;
    this.logitsAll = fields?.logitsAll;
    this.vocabOnly = fields?.vocabOnly;
    this.useMmap = fields?.useMmap;
    this.useMlock = fields?.useMlock;
    this.embeddingOnly = fields?.embeddingOnly;
    this.numThread = fields?.numThread;
    this.numKeep = fields?.numKeep;
    this.seed = fields?.seed;
    this.numPredict = fields?.numPredict;
    this.topK = fields?.topK;
    this.topP = fields?.topP;
    this.tfsZ = fields?.tfsZ;
    this.typicalP = fields?.typicalP;
    this.repeatLastN = fields?.repeatLastN;
    this.temperature = fields?.temperature;
    this.repeatPenalty = fields?.repeatPenalty;
    this.presencePenalty = fields?.presencePenalty;
    this.frequencyPenalty = fields?.frequencyPenalty;
    this.mirostat = fields?.mirostat;
    this.mirostatTau = fields?.mirostatTau;
    this.mirostatEta = fields?.mirostatEta;
    this.penalizeNewline = fields?.penalizeNewline;
    this.streaming = fields?.streaming;
    this.format = fields?.format;
    this.keepAlive = fields?.keepAlive ?? this.keepAlive;
    this.checkOrPullModel = fields?.checkOrPullModel ?? this.checkOrPullModel;
  }

  // Replace
  _llmType() {
    return "chat_ollama";
  }

  /**
   * Download a model onto the local machine.
   *
   * @param {string} model The name of the model to download.
   * @param {PullModelOptions | undefined} options Options for pulling the model.
   * @returns {Promise<void>}
   */
  async pull(model: string, options?: PullModelOptions): Promise<void> {
    const { stream, insecure, logProgress } = {
      stream: true,
      ...options,
    };

    if (stream) {
      for await (const chunk of await this.client.pull({
        model,
        insecure,
        stream,
      })) {
        if (logProgress) {
          console.log(chunk);
        }
      }
    } else {
      const response = await this.client.pull({ model, insecure });
      if (logProgress) {
        console.log(response);
      }
    }
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "ollama",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.options?.temperature ?? undefined,
      ls_max_tokens: params.options?.num_predict ?? undefined,
      ls_stop: options.stop,
    };
  }

  invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<OllamaChatRequest, "messages"> {
    return {
      model: this.model,
      format: this.format,
      keep_alive: this.keepAlive,
      options: {
        numa: this.numa,
        num_ctx: this.numCtx,
        num_batch: this.numBatch,
        num_gpu: this.numGpu,
        main_gpu: this.mainGpu,
        low_vram: this.lowVram,
        f16_kv: this.f16Kv,
        logits_all: this.logitsAll,
        vocab_only: this.vocabOnly,
        use_mmap: this.useMmap,
        use_mlock: this.useMlock,
        embedding_only: this.embeddingOnly,
        num_thread: this.numThread,
        num_keep: this.numKeep,
        seed: this.seed,
        num_predict: this.numPredict,
        top_k: this.topK,
        top_p: this.topP,
        tfs_z: this.tfsZ,
        typical_p: this.typicalP,
        repeat_last_n: this.repeatLastN,
        temperature: this.temperature,
        repeat_penalty: this.repeatPenalty,
        presence_penalty: this.presencePenalty,
        frequency_penalty: this.frequencyPenalty,
        mirostat: this.mirostat,
        mirostat_tau: this.mirostatTau,
        mirostat_eta: this.mirostatEta,
        penalize_newline: this.penalizeNewline,
        stop: options?.stop,
      },
    };
  }

  /**
   * Check if a model exists on the local machine.
   *
   * @param {string} model The name of the model to check.
   * @returns {Promise<boolean>} Whether or not the model exists.
   */
  private async checkModelExistsOnMachine(model: string): Promise<boolean> {
    const { models } = await this.client.list();
    return !!models.find(
      (m) => m.name === model || m.name === `${model}:latest`
    );
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.checkOrPullModel) {
      if (!(await this.checkModelExistsOnMachine(this.model))) {
        await this.pull(this.model, {
          logProgress: true,
        });
      }
    }

    let finalChunk: AIMessageChunk | undefined;
    for await (const chunk of this._streamResponseChunks(
      messages,
      options,
      runManager
    )) {
      if (!finalChunk) {
        finalChunk = chunk.message;
      } else {
        finalChunk = finalChunk.concat(chunk.message);
      }
    }

    // Convert from AIMessageChunk to AIMessage since `generate` expects AIMessage.
    const nonChunkMessage = new AIMessage({
      content: finalChunk?.content ?? "",
      response_metadata: finalChunk?.response_metadata,
      usage_metadata: finalChunk?.usage_metadata,
    });
    return {
      generations: [
        {
          text:
            typeof nonChunkMessage.content === "string"
              ? nonChunkMessage.content
              : "",
          message: nonChunkMessage,
        },
      ],
    };
  }

  /**
   * Implement to support streaming.
   * Should yield chunks iteratively.
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    if (this.checkOrPullModel) {
      if (!(await this.checkModelExistsOnMachine(this.model))) {
        await this.pull(this.model, {
          logProgress: true,
        });
      }
    }

    const params = this.invocationParams(options);
    const ollamaMessages = convertToOllamaMessages(messages);

    const stream = await this.client.chat({
      ...params,
      messages: ollamaMessages,
      stream: true,
    });

    let lastMetadata: Omit<OllamaChatResponse, "message"> | undefined;
    const usageMetadata: UsageMetadata = {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    };

    for await (const chunk of stream) {
      if (options.signal?.aborted) {
        this.client.abort();
      }
      const { message: responseMessage, ...rest } = chunk;
      usageMetadata.input_tokens += rest.prompt_eval_count ?? 0;
      usageMetadata.output_tokens += rest.eval_count ?? 0;
      usageMetadata.total_tokens =
        usageMetadata.input_tokens + usageMetadata.output_tokens;
      lastMetadata = rest;

      yield new ChatGenerationChunk({
        text: responseMessage.content,
        message: new AIMessageChunk({
          content: responseMessage.content,
        }),
      });
      await runManager?.handleLLMNewToken(responseMessage.content);
    }

    // Yield the `response_metadata` as the final chunk.
    yield new ChatGenerationChunk({
      text: "",
      message: new AIMessageChunk({
        content: "",
        response_metadata: lastMetadata,
        usage_metadata: usageMetadata,
      }),
    });
  }
}
