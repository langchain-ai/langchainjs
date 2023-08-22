import { LLM, BaseLLMParams } from "./base.js";
import {
  createOllamaStream,
  OllamaInput,
  OllamaCallOptions,
} from "../util/ollama.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { GenerationChunk } from "../schema/index.js";

/**
 * Class that represents the Ollama language model. It extends the base
 * LLM class and implements the OllamaInput interface.
 */
export class Ollama extends LLM implements OllamaInput {
  declare CallOptions: OllamaCallOptions;

  static lc_name() {
    return "Ollama";
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

  constructor(fields: OllamaInput & BaseLLMParams) {
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

  async *_streamResponseChunks(
    input: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const stream = await this.caller.call(async () =>
      createOllamaStream(
        this.baseUrl,
        { ...this.invocationParams(options), prompt: input },
        options
      )
    );
    for await (const chunk of stream) {
      yield new GenerationChunk({
        text: chunk.response,
        generationInfo: {
          ...chunk,
          response: undefined,
        },
      });
      await runManager?.handleLLMNewToken(chunk.response ?? "");
    }
  }

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const stream = await this.caller.call(async () =>
      createOllamaStream(
        this.baseUrl,
        { ...this.invocationParams(options), prompt },
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
