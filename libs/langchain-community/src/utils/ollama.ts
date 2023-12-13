import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import type { StringWithAutocomplete } from "@langchain/core/utils/types";

export interface OllamaInput {
  embeddingOnly?: boolean;
  f16KV?: boolean;
  frequencyPenalty?: number;
  logitsAll?: boolean;
  lowVram?: boolean;
  mainGpu?: number;
  model?: string;
  baseUrl?: string;
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
}

export interface OllamaRequestParams {
  model: string;
  prompt: string;
  format?: StringWithAutocomplete<"json">;
  options: {
    embedding_only?: boolean;
    f16_kv?: boolean;
    frequency_penalty?: number;
    logits_all?: boolean;
    low_vram?: boolean;
    main_gpu?: number;
    mirostat?: number;
    mirostat_eta?: number;
    mirostat_tau?: number;
    num_batch?: number;
    num_ctx?: number;
    num_gpu?: number;
    num_gqa?: number;
    num_keep?: number;
    num_thread?: number;
    penalize_newline?: boolean;
    presence_penalty?: number;
    repeat_last_n?: number;
    repeat_penalty?: number;
    rope_frequency_base?: number;
    rope_frequency_scale?: number;
    temperature?: number;
    stop?: string[];
    tfs_z?: number;
    top_k?: number;
    top_p?: number;
    typical_p?: number;
    use_mlock?: boolean;
    use_mmap?: boolean;
    vocab_only?: boolean;
  };
}

export interface OllamaCallOptions extends BaseLanguageModelCallOptions {}

export type OllamaGenerationChunk = {
  response: string;
  model: string;
  created_at: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

export async function* createOllamaStream(
  baseUrl: string,
  params: OllamaRequestParams,
  options: OllamaCallOptions
): AsyncGenerator<OllamaGenerationChunk> {
  let formattedBaseUrl = baseUrl;
  if (formattedBaseUrl.startsWith("http://localhost:")) {
    // Node 18 has issues with resolving "localhost"
    // See https://github.com/node-fetch/node-fetch/issues/1624
    formattedBaseUrl = formattedBaseUrl.replace(
      "http://localhost:",
      "http://127.0.0.1:"
    );
  }
  const response = await fetch(`${formattedBaseUrl}/api/generate`, {
    method: "POST",
    body: JSON.stringify(params),
    headers: {
      "Content-Type": "application/json",
    },
    signal: options.signal,
  });
  if (!response.ok) {
    const json = await response.json();
    const error = new Error(
      `Ollama call failed with status code ${response.status}: ${json.error}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).response = response;
    throw error;
  }
  if (!response.body) {
    throw new Error(
      "Could not begin Ollama stream. Please check the given URL and try again."
    );
  }

  const stream = IterableReadableStream.fromReadableStream(response.body);
  const decoder = new TextDecoder();
  let extra = "";
  for await (const chunk of stream) {
    const decoded = extra + decoder.decode(chunk);
    const lines = decoded.split("\n");
    extra = lines.pop() || "";
    for (const line of lines) {
      try {
        yield JSON.parse(line);
      } catch (e) {
        console.warn(`Received a non-JSON parseable chunk: ${line}`);
      }
    }
  }
}
