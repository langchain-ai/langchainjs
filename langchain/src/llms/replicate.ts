import { LLM, BaseLLMParams } from "./base.js";

interface ReplicateInput {
  // owner/model_name:version
  model: `${string}/${string}:${string}`;
  // input is optional, must be an object of string: string
  input: object;
}

export class ReplicateLLM extends LLM implements ReplicateInput {
  model: `${string}/${string}:${string}`;

  apiKey: string;

  input: { prompt: any };

  constructor(fields?: Partial<ReplicateInput> & BaseLLMParams) {
    super(fields ?? {});

    const apiKey = process.env.REPLICATE_API_TOKEN;

    if (!apiKey) {
      throw new Error(
        "Please set the REPLICATE_API_TOKEN environment variable"
      );
    }

    this.apiKey = apiKey;
    this.model = fields?.model ?? this.model;
  }

  _llmType() {
    return "replicate";
  }

  async _call(prompt: string, _stop?: string[]): Promise<string> {
    const { Replicate } = await ReplicateLLM.imports();

    const replicate = new Replicate({
      userAgent: "langchain",
      auth: this.apiKey,
    });

    const model = this.model;
    const input = this.input || {};
    input.prompt = prompt;

    const output = await replicate.run(model, { input });

    return String(output);
  }

  static async imports(): Promise<{
    Replicate: typeof import("replicate").Replicate;
  }> {
    try {
      const { default: Replicate } = await import("replicate");
      return { Replicate };
    } catch (e) {
      throw new Error(
        "Please install replicate as a dependency with, e.g. `yarn add replicate`"
      );
    }
  }
}
