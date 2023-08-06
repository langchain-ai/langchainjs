import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import { IterableReadableStream } from "./stream.js";

export interface OllamaInput {
  model?: string;
  baseUrl?: string;
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
}

export interface OllamaRequestParams {
  model: string;
  prompt: string;
  options: {
    mirostat?: number;
    mirostat_eta?: number;
    mirostat_tau?: number;
    num_ctx?: number;
    num_gpu?: number;
    num_thread?: number;
    repeat_last_n?: number;
    repeat_penalty?: number;
    temperature?: number;
    stop?: string[];
    tfs_z?: number;
    top_k?: number;
    top_p?: number;
  };
}

export interface OllamaCallOptions extends BaseLanguageModelCallOptions {}

export type OllamaGenerationChunk = {
  response: string;
  model: string;
  created_at: string;
  done: boolean;
};

export async function* createOllamaStream(
  baseUrl: string,
  params: OllamaRequestParams,
  options: OllamaCallOptions
): AsyncGenerator<OllamaGenerationChunk> {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    body: JSON.stringify(params),
    headers: {
      "Content-Type": "application/json",
    },
    signal: options.signal,
  });
  if (!response.ok) {
    const error = new Error(
      `Ollama call failed with status code ${response.status}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).response = response;
    console.log(await response.json());
    throw error;
  }
  if (!response.body) {
    throw new Error(
      "Could not begin Ollama stream. Please check the given URL and try again."
    );
  }

  const stream = IterableReadableStream.fromReadableStream(response.body);
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    try {
      yield JSON.parse(decoder.decode(chunk));
    } catch (e) {
      console.warn(
        `Received a non-JSON parseable chunk: ${decoder.decode(chunk)}`
      );
    }
  }
}
