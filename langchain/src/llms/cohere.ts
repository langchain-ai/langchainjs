import { LLM } from "./index.js";
import { LLMCallbackManager } from "../schema/index.js";

interface CohereInput {
  /** Sampling temperature to use */
  temperature: number;

  /**
   * Maximum number of tokens to generate in the completion.
   */
  maxTokens: number;

  /** Model to use */
  model: string;
}

export class Cohere extends LLM implements CohereInput {
  temperature = 0;

  maxTokens = 250;

  model: string;

  apiKey: string;

  constructor(
    fields?: Partial<CohereInput> & {
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

    const apiKey = process.env.COHERE_API_KEY;

    if (!apiKey) {
      throw new Error("Please set the COHERE_API_KEY environment variable");
    }

    this.apiKey = apiKey;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.temperature = fields?.temperature ?? this.temperature;
    this.model = fields?.model ?? this.model;
  }

  _llmType() {
    return "cohere";
  }

  async _call(prompt: string, _stop?: string[]): Promise<string> {
    const { cohere } = await Cohere.imports();

    cohere.init(this.apiKey);

    // Hit the `generate` endpoint on the `large` model
    const generateResponse = await cohere.generate({
      prompt,
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
    });
    try {
      return generateResponse.body.generations[0].text;
    } catch {
      console.log(generateResponse);
      throw new Error("Could not parse response.");
    }
  }

  static async imports(): Promise<{
    cohere: typeof import("cohere-ai");
  }> {
    try {
      const { default: cohere } = await import("cohere-ai");
      return { cohere };
    } catch (e) {
      throw new Error(
        "Please install cohere-ai as a dependency with, e.g. `yarn add cohere-ai`"
      );
    }
  }
}
