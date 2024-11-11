import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { Ollama } from "ollama/browser";
import type { Options as OllamaOptions } from "ollama";
import { OllamaCamelCaseOptions } from "./types.js";

/**
 * Interface for OllamaEmbeddings parameters. Extends EmbeddingsParams and
 * defines additional parameters specific to the OllamaEmbeddings class.
 */
interface OllamaEmbeddingsParams extends EmbeddingsParams {
  /**
   * The Ollama model to use for embeddings.
   * @default "mxbai-embed-large"
   */
  model?: string;

  /**
   * Base URL of the Ollama server
   * @default "http://localhost:11434"
   */
  baseUrl?: string;

  /**
   * Defaults to "5m"
   */
  keepAlive?: string | number;

  /**
   * Whether or not to truncate the input text to fit inside the model's
   * context window.
   * @default false
   */
  truncate?: boolean;

  /**
   * Optional HTTP Headers to include in the request.
   */
  headers?: Headers;

  /**
   * Advanced Ollama API request parameters in camelCase, see
   * https://github.com/ollama/ollama/blob/main/docs/modelfile.md#valid-parameters-and-values
   * for details of the available parameters.
   */
  requestOptions?: OllamaCamelCaseOptions & Partial<OllamaOptions>;
}

export class OllamaEmbeddings extends Embeddings {
  model = "mxbai-embed-large";

  baseUrl = "http://localhost:11434";

  keepAlive: string | number = "5m";

  requestOptions?: Partial<OllamaOptions>;

  client: Ollama;

  truncate = false;

  constructor(fields?: OllamaEmbeddingsParams) {
    super({ maxConcurrency: 1, ...fields });

    this.client = new Ollama({
      host: fields?.baseUrl,
      headers: fields?.headers,
    });
    this.baseUrl = fields?.baseUrl ?? this.baseUrl;

    this.model = fields?.model ?? this.model;
    this.keepAlive = fields?.keepAlive ?? this.keepAlive;
    this.truncate = fields?.truncate ?? this.truncate;
    this.requestOptions = fields?.requestOptions
      ? this._convertOptions(fields?.requestOptions)
      : undefined;
  }

  /** convert camelCased Ollama request options like "useMMap" to
   * the snake_cased equivalent which the ollama API actually uses.
   * Used only for consistency with the llms/Ollama and chatModels/Ollama classes
   */
  _convertOptions(
    requestOptions: OllamaCamelCaseOptions
  ): Partial<OllamaOptions> {
    const snakeCasedOptions: Partial<OllamaOptions> = {};
    const mapping: Record<keyof OllamaCamelCaseOptions, string> = {
      embeddingOnly: "embedding_only",
      frequencyPenalty: "frequency_penalty",
      keepAlive: "keep_alive",
      logitsAll: "logits_all",
      lowVram: "low_vram",
      mainGpu: "main_gpu",
      mirostat: "mirostat",
      mirostatEta: "mirostat_eta",
      mirostatTau: "mirostat_tau",
      numBatch: "num_batch",
      numCtx: "num_ctx",
      numGpu: "num_gpu",
      numKeep: "num_keep",
      numPredict: "num_predict",
      numThread: "num_thread",
      penalizeNewline: "penalize_newline",
      presencePenalty: "presence_penalty",
      repeatLastN: "repeat_last_n",
      repeatPenalty: "repeat_penalty",
      temperature: "temperature",
      stop: "stop",
      tfsZ: "tfs_z",
      topK: "top_k",
      topP: "top_p",
      typicalP: "typical_p",
      useMlock: "use_mlock",
      useMmap: "use_mmap",
      vocabOnly: "vocab_only",
      f16Kv: "f16_kv",
      numa: "numa",
      seed: "seed",
    };

    for (const [key, value] of Object.entries(requestOptions)) {
      const snakeCasedOption = mapping[key as keyof OllamaCamelCaseOptions];
      if (snakeCasedOption) {
        snakeCasedOptions[snakeCasedOption as keyof OllamaOptions] = value;
      } else {
        // Just pass unknown options through
        snakeCasedOptions[key as keyof OllamaOptions] = value;
      }
    }
    return snakeCasedOptions;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embeddingWithRetry(texts);
  }

  async embedQuery(text: string) {
    return (await this.embeddingWithRetry([text]))[0];
  }

  private async embeddingWithRetry(texts: string[]): Promise<number[][]> {
    const res = await this.caller.call(() =>
      this.client.embed({
        model: this.model,
        input: texts,
        keep_alive: this.keepAlive,
        options: this.requestOptions,
        truncate: this.truncate,
      })
    );
    return res.embeddings;
  }
}
