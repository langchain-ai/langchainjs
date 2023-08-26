import type {
  LlamaModel,
  LlamaContext,
  LlamaChatSession,
} from "node-llama-cpp";

import { LLM, BaseLLMParams } from "./base.js";

/**
 * Note that the modelPath is the only required parameter. For testing you
 * can set this in the environment variable `LLAMA_PATH`.
 */
export interface LlamaCppInputs extends BaseLLMParams {
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
  /** If true, reduce VRAM usage at the cost of performance. */
  lowVram?: boolean;
  /** Path to the model on the filesystem. */
  modelPath: string;
  /** If null, a random seed will be used. */
  seed?: null | number;
  /** Force system to keep model in RAM. */
  useMlock?: boolean;
  /** Use mmap if possible. */
  useMmap?: boolean;
  /** Only load the vocabulary, no weights. */
  vocabOnly?: boolean;
}

/**
 *  To use this model you need to have the `node-llama-cpp` module installed.
 *  This can be installed using `npm install -S node-llama-cpp` and the minimum
 *  version supported in version 2.0.0.
 *  This also requires that have a locally built version of Llama2 installed.
 */
export class LlamaCpp extends LLM {
  static inputs: LlamaCppInputs;

  static model: LlamaModel;

  static context: LlamaContext;

  static lc_name() {
    return "Llama2-CPP";
  }

  constructor(inputs: LlamaCppInputs) {
    super(inputs);

    if (inputs.modelPath) {
      LlamaCpp.inputs = inputs;
    } else {
      throw new Error("A path to the Llama2 model is required.");
    }
  }

  _llmType() {
    return "llama2_cpp";
  }

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const { LlamaModel, LlamaContext, LlamaChatSession } =
      await LlamaCpp.imports();

    if (!LlamaCpp.model) {
      LlamaCpp.model = new LlamaModel(LlamaCpp.inputs);
    }

    if (!LlamaCpp.context) {
      LlamaCpp.context = new LlamaContext({ model: LlamaCpp.model });
    }

    const session = new LlamaChatSession({ context: LlamaCpp.context });

    try {
      const compleation = await session.prompt(prompt, undefined, {
        signal: options.signal,
      });
      return compleation;
    } catch (e) {
      throw new Error("Error getting prompt compleation.");
    }
  }

  /** @ignore */
  static async imports(): Promise<{
    LlamaModel: typeof LlamaModel;
    LlamaContext: typeof LlamaContext;
    LlamaChatSession: typeof LlamaChatSession;
  }> {
    try {
      const { LlamaModel, LlamaContext, LlamaChatSession } = await import(
        "node-llama-cpp"
      );
      return { LlamaModel, LlamaContext, LlamaChatSession };
    } catch (e) {
      throw new Error(
        "Please install node-llama-cpp as a dependency with, e.g. `npm install node-llama-cpp`"
      );
    }
  }
}
