import { LLM, BaseLLMParams } from "./base.js";

export interface GPT4AllInput {
  // These are the only two models supported by the gpt4all-ts library currently
  model: "gpt4all-lora-unfiltered-quantized" | "gpt4all-lora-quantized";
  forceDownload?: boolean;
  decoderConfig?: Record<string, unknown>;
}

export class GPT4All extends LLM implements GPT4AllInput {
  model: GPT4AllInput["model"];

  forceDownload: boolean;

  decoderConfig: Record<string, unknown>;

  constructor(fields: GPT4AllInput & BaseLLMParams) {
    super(fields);

    this.model = fields.model;
    this.forceDownload = fields.forceDownload ?? false;
    this.decoderConfig = fields.decoderConfig ?? {};
  }

  _llmType() {
    return "gpt4all";
  }

  /** @ignore */
  async _call(prompt: string, _stop?: string[]): Promise<string> {
    const imports = await GPT4All.imports();

    const gpt4all = new imports.GPT4All(
      this.model,
      this.forceDownload,
      this.decoderConfig
    );
    await gpt4all.init();
    await gpt4all.open();

    const output = await this.caller.call(
      async () => await gpt4all.prompt(prompt)
    );

    gpt4all.close();
    return output;
  }

  /** @ignore */
  static async imports(): Promise<{
    GPT4All: typeof import("gpt4all").GPT4All;
  }> {
    try {
      const { GPT4All } = await import("gpt4all");
      return { GPT4All };
    } catch (e) {
      throw new Error(
        "Please install gpt4all as a dependency with, e.g. `yarn add gpt4all`"
      );
    }
  }
}
