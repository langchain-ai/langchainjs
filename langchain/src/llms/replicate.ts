import { LLM, BaseLLMParams } from "./base.js";

interface ReplicateInput {
  // model_name:version
  model: string;
  // input is optional, must be an object of string: string
  input: object;
}

export class Replicate extends LLM implements ReplicateInput {
  model: string;

  apiKey: string;

  input: object;

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
    const { replicate } = await Replicate.imports();

    replicate.init(this.apiKey);
  }

  static async imports(): Promise<{
    // replicate: typeof import Replicate from "replicate";
  }> {
    try {
      const { default: replicate } = await import("replicate");
      return { replicate };
    } catch (e) {
      throw new Error(
        "Please install replicate as a dependency with, e.g. `yarn add replicate`"
      );
    }
  }
}
