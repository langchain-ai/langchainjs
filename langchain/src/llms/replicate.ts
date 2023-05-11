import { LLM, BaseLLMParams } from "./base.js";

export interface ReplicateInput {
  // owner/model_name:version
  model: `${string}/${string}:${string}`;

  input?: {
    // different models accept different inputs
    [key: string]: string | number | boolean;
  };

  apiKey?: string;
}

export class Replicate extends LLM implements ReplicateInput {
  model: ReplicateInput["model"];

  input: ReplicateInput["input"];

  apiKey: string;

  constructor(fields: ReplicateInput & BaseLLMParams) {
    super(fields);

    const apiKey =
      fields?.apiKey ??
      // eslint-disable-next-line no-process-env
      (typeof process !== "undefined" && process.env?.REPLICATE_API_KEY);

    if (!apiKey) {
      throw new Error("Please set the REPLICATE_API_KEY environment variable");
    }

    this.apiKey = apiKey;
    this.model = fields.model;
    this.input = fields.input ?? {};
  }

  _llmType() {
    return "replicate";
  }

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const imports = await Replicate.imports();

    const replicate = new imports.Replicate({
      userAgent: "langchain",
      auth: this.apiKey,
    });

    const output = await this.caller.callWithOptions(
      { signal: options.signal },
      () =>
        replicate.run(this.model, {
          wait: true,
          input: {
            ...this.input,
            prompt,
          },
        })
    );

    // Note this is a little odd, but the output format is not consistent
    // across models, so it makes some amount of sense.
    return String(output);
  }

  /** @ignore */
  static async imports(): Promise<{
    Replicate: typeof import("replicate").default;
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
