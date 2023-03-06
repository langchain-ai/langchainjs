import { LLM } from "./index.js";
import { LLMCallbackManager } from "../schema/index.js";

interface HFInput {
  /** Model to use */
  model: string;

  /** Sampling temperature to use */
  temperature?: number;

  /**
   * Maximum number of tokens to generate in the completion.
   */
  maxTokens?: number;

  /** Total probability mass of tokens to consider at each step */
  topP?: number;

  /** Integer to define the top tokens considered within the sample operation to create new text. */
  topK?: number;

  /** Penalizes repeated tokens according to frequency */
  frequencyPenalty?: number;
}

export class HuggingFaceInference extends LLM implements HFInput {
  model = "gpt2";

  temperature: number | undefined = undefined;

  maxTokens: number | undefined = undefined;

  topP: number | undefined = undefined;

  topK: number | undefined = undefined;

  frequencyPenalty: number | undefined = undefined;

  constructor(
    fields?: Partial<HFInput> & {
      callbackManager?: LLMCallbackManager;
      verbose?: boolean;
      concurrency?: number;
      cache?: boolean;
    }
  ) {
    super(
      fields?.callbackManager,
      fields?.verbose,
      fields?.concurrency,
      fields?.cache
    );
    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.topP = fields?.topP ?? this.topP;
    this.topK = fields?.topK ?? this.topK;
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
  }

  _llmType() {
    return "huggingface_hub";
  }

  async _call(prompt: string, _stop?: string[]): Promise<string> {
    if (process.env.HUGGINGFACEHUB_API_KEY === "") {
      throw new Error(
        "Please set the HUGGINGFACEHUB_API_KEY environment variable"
      );
    }
    const { HfInference } = await HuggingFaceInference.imports();
    const hf = new HfInference(process.env.HUGGINGFACEHUB_API_KEY ?? "");
    const res = await hf.textGeneration({
      model: this.model,
      parameters: {
        // make it behave similar to openai, returning only the generated text
        return_full_text: false,
        temperature: this.temperature,
        max_new_tokens: this.maxTokens,
        top_p: this.topP,
        top_k: this.topK,
        repetition_penalty: this.frequencyPenalty,
      },
      inputs: prompt,
    });
    return res.generated_text;
  }

  static async imports(): Promise<{
    HfInference: typeof import("@huggingface/inference").HfInference;
  }> {
    try {
      const { HfInference } = await import("@huggingface/inference");
      return { HfInference };
    } catch (e) {
      throw new Error(
        "Please install huggingface as a dependency with, e.g. `yarn add huggingface`"
      );
    }
  }
}
