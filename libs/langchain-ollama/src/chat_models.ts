import {
  AIMessage,
  MessageContentText,
  type BaseMessage,
} from "@langchain/core/messages";
import { type BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  BaseChatModel,
} from "@langchain/core/language_models/chat_models";
import ollama from "ollama/browser";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { AIMessageChunk } from "@langchain/core/messages";

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
              images: [c.image_url],
            };
          } else if (c.image_url.url && typeof c.image_url.url === "string") {
            return {
              role: "user",
              content: "",
              images: [c.image_url.url],
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

export interface OllamaMessage {
  role: string;
  content: string;
  images?: Uint8Array[] | string[];
}

export interface ChatOllamaCallOptions extends BaseLanguageModelCallOptions {}

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
  keepAlive?: string | number;
}

/**
 * Integration with a chat model.
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

  keepAlive?: string | number;

  constructor(fields?: ChatOllamaInput) {
    super(fields ?? {});
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
    this.keepAlive = fields?.keepAlive;
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
      for await (const chunk of await ollama.pull({
        model,
        insecure,
        stream,
      })) {
        if (logProgress) {
          console.log(chunk);
        }
      }
    } else {
      const response = await ollama.pull({ model, insecure });
      if (logProgress) {
        console.log(response);
      }
    }
  }

  invocationParams(_options?: this["ParsedCallOptions"]) {
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
      },
    };
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const { models } = await ollama.list();
    // By default, pull the model if it does not exist.
    if (!models.find((model) => model.name === this.model)) {
      await this.pull(this.model);
    }

    if (this.streaming) {
      let finalChunk: ChatGenerationChunk | undefined;
      for await (const chunk of this._streamResponseChunks(
        messages,
        options,
        runManager
      )) {
        if (!finalChunk) {
          finalChunk = chunk;
        } else {
          finalChunk = finalChunk.concat(chunk);
        }
      }
      return {
        generations: [
          {
            text: finalChunk?.text ?? "",
            message: finalChunk?.message as AIMessageChunk,
          },
        ],
      };
    }
    const params = this.invocationParams(options);
    const ollamaMessages = convertToOllamaMessages(messages);

    const response = await ollama.chat({
      ...params,
      messages: ollamaMessages,
      stream: false,
    });
    const { message: responseMessage, ...rest } = response;

    runManager?.handleLLMNewToken(responseMessage.content);
    return {
      generations: [
        {
          text: responseMessage.content,
          message: new AIMessage({
            content: responseMessage.content,
            response_metadata: {
              ...rest,
            },
          }),
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
    const params = this.invocationParams(options);
    const ollamaMessages = convertToOllamaMessages(messages);

    const stream = ollama.chat({
      ...params,
      messages: ollamaMessages,
      stream: true,
    });
    for await (const chunk of await stream) {
      const { message: responseMessage, ...rest } = chunk;
      yield new ChatGenerationChunk({
        text: responseMessage.content,
        message: new AIMessageChunk({
          content: responseMessage.content,
          response_metadata: {
            ...rest,
          },
        }),
      });
      await runManager?.handleLLMNewToken(responseMessage.content);
    }
  }
}
