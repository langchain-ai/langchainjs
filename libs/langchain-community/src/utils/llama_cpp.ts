/* eslint-disable import/no-extraneous-dependencies */
import {
  LlamaModel,
  LlamaContext,
  LlamaChatSession,
  LlamaJsonSchemaGrammar,
  LlamaGrammar,
  GbnfJsonSchema,
} from "node-llama-cpp";

/**
 * Note that the modelPath is the only required parameter. For testing you
 * can set this in the environment variable `LLAMA_PATH`.
 */
export interface LlamaBaseCppInputs {
  /** Prompt processing batch size. */
  batchSize?: number;
  /** Text context size. */
  contextSize?: number;
  /** Embedding mode only. */
  embedding?: boolean;
  /** Use fp16 for KV cache. */
  f16Kv?: boolean;
  /** Number of layers to store in VRAM. */
  gpuLayers?: number;
  /** The llama_eval() call computes all logits, not just the last one. */
  logitsAll?: boolean;
  /** */
  maxTokens?: number;
  /** Path to the model on the filesystem. */
  modelPath: string;
  /** Add the begining of sentence token.  */
  prependBos?: boolean;
  /** If null, a random seed will be used. */
  seed?: null | number;
  /** The randomness of the responses, e.g. 0.1 deterministic, 1.5 creative, 0.8 balanced, 0 disables. */
  temperature?: number;
  /** Number of threads to use to evaluate tokens. */
  threads?: number;
  /** Trim whitespace from the end of the generated text Disabled by default. */
  trimWhitespaceSuffix?: boolean;
  /** Consider the n most likely tokens, where n is 1 to vocabulary size, 0 disables (uses full vocabulary). Note: only applies when `temperature` > 0. */
  topK?: number;
  /** Selects the smallest token set whose probability exceeds P, where P is between 0 - 1, 1 disables. Note: only applies when `temperature` > 0. */
  topP?: number;
  /** Force system to keep model in RAM. */
  useMlock?: boolean;
  /** Use mmap if possible. */
  useMmap?: boolean;
  /** Only load the vocabulary, no weights. */
  vocabOnly?: boolean;
  /** JSON schema to be used to format output. Also known as `grammar`. */
  jsonSchema?: object;
  /** GBNF string to be used to format output. Also known as `grammar`. */
  gbnf?: string;
}

export function createLlamaModel(inputs: LlamaBaseCppInputs): LlamaModel {
  const options = {
    gpuLayers: inputs?.gpuLayers,
    modelPath: inputs.modelPath,
    useMlock: inputs?.useMlock,
    useMmap: inputs?.useMmap,
    vocabOnly: inputs?.vocabOnly,
    jsonSchema: inputs?.jsonSchema,
    gbnf: inputs?.gbnf,
  };

  return new LlamaModel(options);
}

export function createLlamaContext(
  model: LlamaModel,
  inputs: LlamaBaseCppInputs
): LlamaContext {
  const options = {
    batchSize: inputs?.batchSize,
    contextSize: inputs?.contextSize,
    embedding: inputs?.embedding,
    f16Kv: inputs?.f16Kv,
    logitsAll: inputs?.logitsAll,
    model,
    prependBos: inputs?.prependBos,
    seed: inputs?.seed,
    threads: inputs?.threads,
  };

  return new LlamaContext(options);
}

export function createLlamaSession(context: LlamaContext): LlamaChatSession {
  return new LlamaChatSession({ context });
}

export function createLlamaJsonSchemaGrammar(
  schemaString: object | undefined
): LlamaJsonSchemaGrammar<GbnfJsonSchema> | undefined {
  if (schemaString === undefined) {
    return undefined;
  }

  const schemaJSON = schemaString as GbnfJsonSchema;
  return new LlamaJsonSchemaGrammar(schemaJSON);
}

export function createCustomGrammar(
  filePath: string | undefined
): LlamaGrammar | undefined {
  return filePath === undefined
    ? undefined
    : new LlamaGrammar({ grammar: filePath });
}
