import { LlamaModel, LlamaContext, LlamaChatSession } from "node-llama-cpp";
import {
  LlamaBaseCppInputs,
  createLlamaModel,
  createLlamaContext,
  createLlamaSession,
} from "../util/llama_cpp.js";
import { LLM, BaseLLMCallOptions, BaseLLMParams } from "./base.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { GenerationChunk } from "../schema/index.js";

/**
 * Note that the modelPath is the only required parameter. For testing you
 * can set this in the environment variable `LLAMA_PATH`.
 */
export interface LlamaCppInputs extends LlamaBaseCppInputs, BaseLLMParams {}

export interface LlamaCppCallOptions extends BaseLLMCallOptions {
  /** The maximum number of tokens the response should contain. */
  maxTokens?: number;
  /** A function called when matching the provided token array */
  onToken?: (tokens: number[]) => void;
}

/**
 *  To use this model you need to have the `node-llama-cpp` module installed.
 *  This can be installed using `npm install -S node-llama-cpp` and the minimum
 *  version supported in version 2.0.0.
 *  This also requires that have a locally built version of Llama2 installed.
 */
export class LlamaCpp extends LLM<LlamaCppCallOptions> {
  declare CallOptions: LlamaCppCallOptions;

  static inputs: LlamaCppInputs;

  maxTokens?: number;

  temperature?: number;

  topK?: number;

  topP?: number;

  trimWhitespaceSuffix?: boolean;

  _model: LlamaModel;

  _context: LlamaContext;

  _session: LlamaChatSession;

  static lc_name() {
    return "LlamaCpp";
  }

  constructor(inputs: LlamaCppInputs) {
    super(inputs);
    this.maxTokens = inputs?.maxTokens;
    this.temperature = inputs?.temperature;
    this.topK = inputs?.topK;
    this.topP = inputs?.topP;
    this.trimWhitespaceSuffix = inputs?.trimWhitespaceSuffix;
    this._model = createLlamaModel(inputs);
    this._context = createLlamaContext(this._model, inputs);
    this._session = createLlamaSession(this._context);
  }

  _llmType() {
    return "llama2_cpp";
  }

  /** @ignore */
  async _call(
    prompt: string,
    _options?: this["ParsedCallOptions"]
  ): Promise<string> {
    try {
      const promptOptions = {
        maxTokens: this?.maxTokens,
        temperature: this?.temperature,
        topK: this?.topK,
        topP: this?.topP,
        trimWhitespaceSuffix: this?.trimWhitespaceSuffix,
      };
      const completion = await this._session.prompt(prompt, promptOptions);
      return completion;
    } catch (e) {
      throw new Error("Error getting prompt completion.");
    }
  }

  async *_streamResponseChunks(
    prompt: string,
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const promptOptions = {
      temperature: this?.temperature,
      topK: this?.topK,
      topP: this?.topP,
    };

    const stream = await this.caller.call(async () =>
      this._context.evaluate(this._context.encode(prompt), promptOptions)
    );

    for await (const chunk of stream) {
      yield new GenerationChunk({
        text: this._context.decode([chunk]),
        generationInfo: {},
      });
      await runManager?.handleLLMNewToken(this._context.decode([chunk]) ?? "");
    }
  }
}
