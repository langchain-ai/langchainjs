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

  mirostat?: number;

  mirostatEta?: number;

  mirostatTau?: number;

  numCtx?: number;

  numGpu?: number;

  numThread?: number;

  repeatLastN?: number;

  repeatPenalty?: number;

  temperature?: number;

  stop?: string[];

  tfsZ?: number;

  topK?: number;

  topP?: number;

  constructor(fields: OllamaInput & BaseChatModelParams) {
    super(fields);
    this.model = fields.model ?? this.model;
    this.baseUrl = fields.baseUrl?.endsWith("/")
      ? fields.baseUrl.slice(0, -1)
      : fields.baseUrl ?? this.baseUrl;
    this.mirostat = fields.mirostat;
    this.mirostatEta = fields.mirostatEta;
    this.mirostatTau = fields.mirostatTau;
    this.numCtx = fields.numCtx;
    this.numGpu = fields.numGpu;
    this.numThread = fields.numThread;
    this.repeatLastN = fields.repeatLastN;
    this.repeatPenalty = fields.repeatPenalty;
    this.temperature = fields.temperature;
    this.stop = fields.stop;
    this.tfsZ = fields.tfsZ;
    this.topK = fields.topK;
    this.topP = fields.topP;
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
        mirostat: this.mirostat,
        mirostat_eta: this.mirostatEta,
        mirostat_tau: this.mirostatTau,
        num_ctx: this.numCtx,
        num_gpu: this.numGpu,
        num_thread: this.numThread,
        repeat_last_n: this.repeatLastN,
        repeat_penalty: this.repeatPenalty,
        temperature: this.temperature,
        stop: options?.stop ?? this.stop,
        tfs_z: this.tfsZ,
        top_k: this.topK,
        top_p: this.topP,
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
        let rolePrefix;
        if (message._getType() === "human") {
          rolePrefix = "Human: ";
        } else if (message._getType() === "ai") {
          rolePrefix = "Assistant: ";
        } else if (message._getType() === "system") {
          rolePrefix = "";
        } else if (ChatMessage.isInstance(message)) {
          rolePrefix = `${message.role}: `;
        } else {
          console.warn(
            `Unsupported message type passed to Ollama: "${message._getType()}"`
          );
          rolePrefix = "";
        }
        return `${rolePrefix}${message.content}`;
      })
      .join("\n");
    return `${formattedMessages}\nAssistant: `;
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
