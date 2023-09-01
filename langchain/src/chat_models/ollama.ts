import { SimpleChatModel, BaseChatModelParams } from "./base.js";
import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import { createOllamaStream, OllamaInput } from "../util/ollama.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import {
  AIMessageChunk,
  BaseMessage,
  ChatGenerationChunk,
  ChatMessage,
} from "../schema/index.js";

/**
 * An interface defining the options for an Ollama API call. It extends
 * the BaseLanguageModelCallOptions interface.
 */
export interface OllamaCallOptions extends BaseLanguageModelCallOptions {}

/**
 * A class that enables calls to the Ollama API to access large language
 * models in a chat-like fashion. It extends the SimpleChatModel class and
 * implements the OllamaInput interface.
 */
export class ChatOllama extends SimpleChatModel implements OllamaInput {
  declare CallOptions: OllamaCallOptions;

  static lc_name() {
    return "ChatOllama";
  }

  lc_serializable = true;

  model = "llama2";

  baseUrl = "http://localhost:11434";

  embeddingOnly?: boolean;

  f16KV?: boolean;

  frequencyPenalty?: number;

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

  constructor(fields: OllamaInput & BaseChatModelParams) {
    super(fields);
    this.model = fields.model ?? this.model;
    this.baseUrl = fields.baseUrl?.endsWith("/")
      ? fields.baseUrl.slice(0, -1)
      : fields.baseUrl ?? this.baseUrl;
    this.embeddingOnly = fields.embeddingOnly;
    this.f16KV = fields.f16KV;
    this.frequencyPenalty = fields.frequencyPenalty;
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

  async *_streamResponseChunks(
    input: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const stream = await this.caller.call(async () =>
      createOllamaStream(
        this.baseUrl,
        {
          ...this.invocationParams(options),
          prompt: this._formatMessagesAsPrompt(input),
        },
        options
      )
    );
    for await (const chunk of stream) {
      yield new ChatGenerationChunk({
        text: chunk.response,
        message: new AIMessageChunk({ content: chunk.response }),
      });
      await runManager?.handleLLMNewToken(chunk.response ?? "");
    }
  }

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
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const stream = await this.caller.call(async () =>
      createOllamaStream(
        this.baseUrl,
        {
          ...this.invocationParams(options),
          prompt: this._formatMessagesAsPrompt(messages),
        },
        options
      )
    );
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk.response);
    }
    return chunks.join("");
  }
}
