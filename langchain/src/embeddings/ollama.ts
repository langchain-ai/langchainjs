import { OllamaInput, OllamaRequestParams } from "../util/ollama.js";
import { Embeddings, EmbeddingsParams } from "./base.js";

type BaseUrl = {
  url?: string;
};

type Model = {
  model: string;
};

type CamelCasedRequestOptions = Omit<OllamaInput, "baseUrl" | "model">;

type OllamaRequestOptions = {
  requestOptions?: CamelCasedRequestOptions;
};

export default class OllamaEmbeddings extends Embeddings {
  // Embeddings model to use, example: "llama2:13b".
  model: string;

  // Other model api options, see https://github.com/jmorganca/ollama/blob/main/docs/modelfile.md#valid-parameters-and-values
  requestOptions?: OllamaRequestParams["options"];

  // base url of the ollama server, defaults to "http://localhost:11434"
  baseUrl = "http://localhost:11434";

  constructor(
    params: EmbeddingsParams & Model & BaseUrl & OllamaRequestOptions
  ) {
    super(params);

    this.model = params.model;

    if (params.url) {
      this.baseUrl = params.url;
    }

    if (params.requestOptions) {
      this.requestOptions = this._convertOptions(params.requestOptions);
    }
  }

  // convert camelCased Ollama request options like "useMMap" to
  // the snake_cased equivalent which the ollama API actually uses.
  // Used only for consistency with the llms/Ollama and chatModels/Ollama classes
  _convertOptions(requestOptions?: CamelCasedRequestOptions) {
    if (!requestOptions) {
      return;
    }

    const snakeCasedOptions: Record<string, unknown> = {};
    const mapping: Record<keyof CamelCasedRequestOptions, string> = {
      embeddingOnly: "embedding_only",
      f16KV: "f16_kv",
      frequencyPenalty: "frequency_penalty",
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
      }
    }
    return snakeCasedOptions;
  }

  async _request(prompt: string): Promise<number[]> {
    const { model, baseUrl, requestOptions } = this;

    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        model,
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

  async _embed(strings: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for await (const prompt of strings) {
      const embedding = await this._request(prompt);
      embeddings.push(embedding);
    }

    return embeddings;
  }

  embedDocuments = async (documents: string[]) => this._embed(documents);

  embedQuery = async (document: string) =>
    (await this.embedDocuments([document]))[0];
}
