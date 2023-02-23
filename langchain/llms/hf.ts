import type { HuggingFace as HuggingFaceT } from "huggingface";
import { LLM, LLMCallbackManager } from ".";

let HuggingFace: typeof HuggingFaceT | null = null;

try {
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  ({ HuggingFace } = require("huggingface"));
} catch {
  // ignore error, will be throw in constructor
}

interface HFInput {
  /** Model to use */
  model: string;
}

export class HuggingFaceInference extends LLM implements HFInput {
  model = "gpt2";

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
    /**
     * Throw error at construction time
     * if huggingface package is not installed.
     */
    if (HuggingFace === null) {
      throw new Error(
        "Please install huggingface as a dependency with, e.g. `yarn add huggingface`"
      );
    }
    this.model = fields?.model ?? this.model;
  }

  _llmType() {
    return "huggingface_hub";
  }

  async _call(prompt: string, _stop?: string[]): Promise<string> {
    if (HuggingFace === null) {
      throw new Error(
        "Please install huggingface as a dependency with, e.g. `yarn add huggingface`"
      );
    }
    if (process.env.HUGGINGFACEHUB_API_KEY === "") {
      throw new Error(
        "Please set the HUGGINGFACEHUB_API_KEY environment variable"
      );
    }
    const hf = new HuggingFace(process.env.HUGGINGFACEHUB_API_KEY ?? "");
    const res = await hf.textGeneration({
      model: this.model,
      inputs: prompt,
    });
    return res.generated_text;
  }
}
