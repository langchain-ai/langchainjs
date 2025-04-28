import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { OllamaInput, OllamaRequestParams } from "../utils/ollama.js";

type CamelCasedRequestOptions = Omit<
  OllamaInput,
  "baseUrl" | "model" | "format" | "headers"
>;

/**
 * Interface for OllamaEmbeddings parameters. Extends EmbeddingsParams and
 * defines additional parameters specific to the OllamaEmbeddings class.
 */
interface OllamaEmbeddingsParams extends EmbeddingsParams {
  /** The Ollama model to use, e.g: "llama2:13b" */
  model?: string;

  /** Base URL of the Ollama server, defaults to "http://localhost:11434" */
  baseUrl?: string;

  /** Extra headers to include in the Ollama API request */
  headers?: Record<string, string>;

  /** Defaults to "5m" */
  keepAlive?: string;

  /** Advanced Ollama API request parameters in camelCase, see
   * https://github.com/jmorganca/ollama/blob/main/docs/modelfile.md#valid-parameters-and-values
   * for details of the available parameters.
   */
  requestOptions?: CamelCasedRequestOptions;
}

/**
 * @deprecated OllamaEmbeddings have been moved to the `@langchain/ollama` package. Install it with `npm install @langchain/ollama`.
 */
export class OllamaEmbeddings extends Embeddings {
  model = "llama2";

  baseUrl = "http://localhost:11434";

  headers?: Record<string, string>;

  keepAlive = "5m";

  requestOptions?: OllamaRequestParams["options"];

  constructor(params?: OllamaEmbeddingsParams) {
    super({ maxConcurrency: 1, ...params });

    if (params?.model) {
      this.model = params.model;
    }

    if (params?.baseUrl) {
      this.baseUrl = params.baseUrl;
    }

    if (params?.headers) {
      this.headers = params.headers;
    }

    if (params?.keepAlive) {
      this.keepAlive = params.keepAlive;
    }

    if (params?.requestOptions) {
      this.requestOptions = this._convertOptions(params.requestOptions);
    }
  }

  /** convert camelCased Ollama request options like "useMMap" to
   * the snake_cased equivalent which the ollama API actually uses.
   * Used only for consistency with the llms/Ollama and chatModels/Ollama classes
   */
  _convertOptions(requestOptions: CamelCasedRequestOptions) {
    const snakeCasedOptions: Record<string, unknown> = {};
    const mapping: Record<keyof CamelCasedRequestOptions, string> = {
      embeddingOnly: "embedding_only",
      f16KV: "f16_kv",
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
      numGqa: "num_gqa",
      numKeep: "num_keep",
      numPredict: "num_predict",
      numThread: "num_thread",
      penalizeNewline: "penalize_newline",
      presencePenalty: "presence_penalty",
      repeatLastN: "repeat_last_n",
      repeatPenalty: "repeat_penalty",
      ropeFrequencyBase: "rope_frequency_base",
      ropeFrequencyScale: "rope_frequency_scale",
      temperature: "temperature",
      stop: "stop",
      tfsZ: "tfs_z",
      topK: "top_k",
      topP: "top_p",
      typicalP: "typical_p",
      useMLock: "use_mlock",
      useMMap: "use_mmap",
      vocabOnly: "vocab_only",
    };

    for (const [key, value] of Object.entries(requestOptions)) {
      const snakeCasedOption = mapping[key as keyof CamelCasedRequestOptions];
      if (snakeCasedOption) {
        snakeCasedOptions[snakeCasedOption] = value;
      } else {
        // Just pass unknown options through
        snakeCasedOptions[key] = value;
      }
    }
    return snakeCasedOptions;
  }

  async _request(prompt: string): Promise<number[]> {
    const { model, baseUrl, keepAlive, requestOptions } = this;

    let formattedBaseUrl = baseUrl;
    if (formattedBaseUrl.startsWith("http://localhost:")) {
      // Node 18 has issues with resolving "localhost"
      // See https://github.com/node-fetch/node-fetch/issues/1624
      formattedBaseUrl = formattedBaseUrl.replace(
        "http://localhost:",
        "http://127.0.0.1:"
      );
    }

    const response = await fetch(`${formattedBaseUrl}/api/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify({
        prompt,
        model,
        keep_alive: keepAlive,
        options: requestOptions,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Request to Ollama server failed: ${response.status} ${response.statusText}`
      );
    }

    const json = await response.json();
    return json.embedding;
  }

  async _embed(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = await Promise.all(
      texts.map((text) => this.caller.call(() => this._request(text)))
    );

    return embeddings;
  }

  async embedDocuments(documents: string[]) {
    return this._embed(documents);
  }

  async embedQuery(document: string) {
    return (await this.embedDocuments([document]))[0];
  }
}
