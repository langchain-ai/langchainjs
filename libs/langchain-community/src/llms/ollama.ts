import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { GenerationChunk } from "@langchain/core/outputs";
import type { StringWithAutocomplete } from "@langchain/core/utils/types";
import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";

import {
  createOllamaGenerateStream,
  OllamaInput,
  OllamaCallOptions,
} from "../utils/ollama.js";

/**
 * Class that represents the Ollama language model. It extends the base
 * LLM class and implements the OllamaInput interface.
 * @example
 * ```typescript
 * const ollama = new Ollama({
 *   baseUrl: "http://api.example.com",
 *   model: "llama2",
 * });
 *
 * // Streaming translation from English to German
 * const stream = await ollama.stream(
 *   `Translate "I love programming" into German.`
 * );
 *
 * const chunks = [];
 * for await (const chunk of stream) {
 *   chunks.push(chunk);
 * }
 *
 * console.log(chunks.join(""));
 * ```
 */
export class Ollama extends LLM<OllamaCallOptions> implements OllamaInput {
  static lc_name() {
    return "Ollama";
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

  format?: StringWithAutocomplete<"json">;

  constructor(fields: OllamaInput & BaseLLMParams) {
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
    this.format = fields.format;
  }

  _llmType() {
    return "ollama";
  }

  invocationParams(options?: this["ParsedCallOptions"]) {
    return {
      model: this.model,
      format: this.format,
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

  async *_streamResponseChunks(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const stream = await this.caller.call(async () =>
      createOllamaGenerateStream(
        this.baseUrl,
        { ...this.invocationParams(options), prompt },
        options
      )
    );
    for await (const chunk of stream) {
      if (!chunk.done) {
        yield new GenerationChunk({
          text: chunk.response,
          generationInfo: {
            ...chunk,
            response: undefined,
          },
        });
        await runManager?.handleLLMNewToken(chunk.response ?? "");
      } else {
        yield new GenerationChunk({
          text: "",
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

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const chunks = [];
    for await (const chunk of this._streamResponseChunks(
      prompt,
      options,
      runManager
    )) {
      chunks.push(chunk.text);
    }
    return chunks.join("");
  }
}
