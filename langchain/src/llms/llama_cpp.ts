import { LLM, BaseLLMParams } from "./base.js";
import type { LlamaModel, LlamaContext, LlamaChatSession } from "node-llama-cpp";
/**
 * Documentation regarding the parameters can be found as part of the llama-cpp-node documentation.
 * Note that the modelPath is the only required parameter.
 */
export interface LlamaCppInputs extends BaseLLMParams {
	batchSize?: number;
	contextSize?: number;
	embedding?: boolean;
	f16Kv?: boolean;
	gpuLayers?: number;
	logitsAll?: boolean;
	lowVram?: boolean;
	modelPath: string;
	seed?: null | number;
	useMlock?: boolean;
	useMmap?: boolean;
	vocabOnly?: boolean;
}

/**
 *  To use this model you need to have the `node-llama-cpp` module installed.
 */
export class LlamaCpp extends LLM {

	batchSize = 8;
	contextSize = 512;
	embedding?: boolean;
	f16Kv = true;
	gpuLayers?: number;
	logitsAll = false;
	lowVram?: boolean;
	modelPath: string;
	seed = -1;
	useMlock = false;
	useMmap = true;
	vocabOnly = false;

	static lc_name() {
      return "Llama2-CPP";
    }

	constructor(fields: LlamaCppInputs) {
		super(fields);
		if (fields.modelPath) {
			this.batchSize = fields?.batchSize ?? this.batchSize;
			this.contextSize = fields?.contextSize ?? this.contextSize;
			//this.embedding = fields.embedding;
			this.f16Kv = fields?.f16Kv ?? this.f16Kv;
			//this.gpuLayers = fields.gpuLayers;
			this.logitsAll = fields?.logitsAll ?? this.logitsAll;
			//this.lowVram = fields.lowVram;
			this.modelPath = fields.modelPath;
			this.seed = fields?.seed ?? this.seed;
			this.useMlock = fields?.useMlock ?? this.useMlock;
			this.useMmap = fields?.useMmap ?? this.useMmap;
			this.vocabOnly = fields?.vocabOnly ?? this.vocabOnly;
		} else {
			throw new Error(
	          "A path to the Llama2 model is required."
	        );
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
		const { LlamaModel, LlamaContext, LlamaChatSession }  = await LlamaCpp.imports();

		const model = new LlamaModel({
			batchSize: this.batchSize,
			contextSize: this.contextSize,
			f16Kv: this.f16Kv,
			logitsAll: this.logitsAll,
			modelPath: this.modelPath,
			seed: this.seed,
			useMlock: this.useMlock,
			useMmap: this.useMmap,
			vocabOnly: this.vocabOnly
		});
		const context = new LlamaContext({model});
		const session = new LlamaChatSession({context})
		try {
			const compleation = await session.prompt(prompt, undefined, {signal: options.signal});
			return compleation;
		} catch (e) {
			throw new Error(
				"Error getting prompt compleation: " + e
			);
		}
	}


	/** @ignore */
	static async imports(): Promise<{
		LlamaModel: typeof LlamaModel;
		LlamaContext: typeof LlamaContext;
		LlamaChatSession: typeof LlamaChatSession;
	}> {
		try {
			const {
				LlamaModel,
				LlamaContext,
				LlamaChatSession
	        } = await import("node-llama-cpp");
			return { LlamaModel, LlamaContext, LlamaChatSession };
		} catch (e) {
			throw new Error(
				"Please install cohere-ai as a dependency with, e.g. `npm install node-llama-cpp`"
			);
		}
	}
}
