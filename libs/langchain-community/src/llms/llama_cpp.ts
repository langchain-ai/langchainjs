/* eslint-disable import/no-extraneous-dependencies */
import {
  LlamaModel,
  LlamaContext,
  LlamaChatSession,
  LlamaJsonSchemaGrammar,
  LlamaGrammar,
  getLlama,
  GbnfJsonSchema,
} from "node-llama-cpp";
import {
  LLM,
  type BaseLLMCallOptions,
  type BaseLLMParams,
} from "@langchain/core/language_models/llms";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { GenerationChunk } from "@langchain/core/outputs";

import {
  LlamaBaseCppInputs,
  createLlamaModel,
  createLlamaContext,
  createLlamaSession,
  createLlamaJsonSchemaGrammar,
  createCustomGrammar,
} from "../utils/llama_cpp.js";

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
  lc_serializable = true;

  static inputs: LlamaCppInputs;

  maxTokens?: number;

  temperature?: number;

  topK?: number;

  topP?: number;

  trimWhitespaceSuffix?: boolean;

  _model: LlamaModel;

  _context: LlamaContext;

  _session: LlamaChatSession;

  _jsonSchema: LlamaJsonSchemaGrammar<GbnfJsonSchema> | undefined;

  _gbnf: LlamaGrammar | undefined;

  static lc_name() {
    return "LlamaCpp";
  }

  public constructor(inputs: LlamaCppInputs) {
    super(inputs);
    this.maxTokens = inputs?.maxTokens;
    this.temperature = inputs?.temperature;
    this.topK = inputs?.topK;
    this.topP = inputs?.topP;
    this.trimWhitespaceSuffix = inputs?.trimWhitespaceSuffix;
  }

  /**
   * Initializes the llama_cpp model for usage.
   * @param inputs - the inputs passed onto the model.
   * @returns A Promise that resolves to the LlamaCpp type class.
   */
  public static async initialize(inputs: LlamaCppInputs): Promise<LlamaCpp> {
    const instance = new LlamaCpp(inputs);
    const llama = await getLlama();

    instance._model = await createLlamaModel(inputs, llama);
    instance._context = await createLlamaContext(instance._model, inputs);
    instance._jsonSchema = await createLlamaJsonSchemaGrammar(
      inputs?.jsonSchema,
      llama
    );
    instance._gbnf = await createCustomGrammar(inputs?.gbnf, llama);
    instance._session = createLlamaSession(instance._context);

    return instance;
  }

  _llmType() {
    return "llama_cpp";
  }

  /** @ignore */
  async _call(
    prompt: string,
    options?: this["ParsedCallOptions"]
  ): Promise<string> {
    try {
      let promptGrammer;

      if (this._jsonSchema !== undefined) {
        promptGrammer = this._jsonSchema;
      } else if (this._gbnf !== undefined) {
        promptGrammer = this._gbnf;
      } else {
        promptGrammer = undefined;
      }
      const promptOptions = {
        grammar: promptGrammer,
        onToken: options?.onToken,
        maxTokens: this?.maxTokens,
        temperature: this?.temperature,
        topK: this?.topK,
        topP: this?.topP,
        trimWhitespaceSuffix: this?.trimWhitespaceSuffix,
      };

      const completion = await this._session.prompt(prompt, promptOptions);

      if (this._jsonSchema !== undefined && completion !== undefined) {
        return this._jsonSchema.parse(completion) as unknown as string;
      }

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
      maxTokens: this?.maxTokens,
      topK: this?.topK,
      topP: this?.topP,
    };

    if (this._context.sequencesLeft === 0) {
      this._context = await createLlamaContext(this._model, LlamaCpp.inputs);
    }
    const sequence = this._context.getSequence();
    const tokens = this._model.tokenize(prompt);

    const stream = await this.caller.call(async () =>
      sequence.evaluate(tokens, promptOptions)
    );

    for await (const chunk of stream) {
      yield new GenerationChunk({
        text: this._model.detokenize([chunk]),
        generationInfo: {},
      });
      await runManager?.handleLLMNewToken(
        this._model.detokenize([chunk]) ?? ""
      );
    }
  }
}
