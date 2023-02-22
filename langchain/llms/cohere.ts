import { LLM, LLMCallbackManager } from ".";

interface CohereInput {
  /** Sampling temperature to use */
  temperature: number;

  /**
   * Maximum number of tokens to generate in the completion. -1 returns as many
   * tokens as possible given the prompt and the model's maximum context size.
   */
  maxTokens: number;

  /** Model to use */
  model: string;
}

export class Cohere extends LLM implements CohereInput {
  temperature = 0;

  maxTokens = 250;

  model: string;

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

    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.temperature = fields?.temperature ?? this.temperature;
    this.model = fields?.model ?? this.model;
  }

  _llmType() {
    return "cohere";
  }

  async _call(prompt: string, _stop?: string[]): Promise<string> {
    // eslint-disable-next-line global-require,import/no-extraneous-dependencies,@typescript-eslint/no-var-requires
    const cohere = require("cohere-ai");

    cohere.init(process.env.COHERE_API_KEY);

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
}
