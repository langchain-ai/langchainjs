import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Interface defining the structure of the input data for the Replicate
 * class. It includes details about the model to be used, any additional
 * input parameters, and the API key for the Replicate service.
 */
export interface ReplicateInput {
  // owner/model_name:version
  model: `${string}/${string}:${string}`;

  input?: {
    // different models accept different inputs
    [key: string]: string | number | boolean;
  };

  apiKey?: string;

  /** The key used to pass prompts to the model. */
  promptKey?: string;
}

/**
 * Class responsible for managing the interaction with the Replicate API.
 * It handles the API key and model details, makes the actual API calls,
 * and converts the API response into a format usable by the rest of the
 * LangChain framework.
 * @example
 * ```typescript
 * const model = new Replicate({
 *   model: "replicate/flan-t5-xl:3ae0799123a1fe11f8c89fd99632f843fc5f7a761630160521c4253149754523",
 * });
 *
 * const res = await model.call(
 *   "Question: What would be a good company name for a company that makes colorful socks?\nAnswer:"
 * );
 * console.log({ res });
 * ```
 */
export class Replicate extends LLM implements ReplicateInput {
  static lc_name() {
    return "Replicate";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "REPLICATE_API_TOKEN",
    };
  }

  lc_serializable = true;

  model: ReplicateInput["model"];

  input: ReplicateInput["input"];

  apiKey: string;

  promptKey?: string;

  constructor(fields: ReplicateInput & BaseLLMParams) {
    super(fields);

    const apiKey =
      fields?.apiKey ??
      getEnvironmentVariable("REPLICATE_API_KEY") ?? // previous environment variable for backwards compatibility
      getEnvironmentVariable("REPLICATE_API_TOKEN"); // current environment variable, matching the Python library

    if (!apiKey) {
      throw new Error(
        "Please set the REPLICATE_API_TOKEN environment variable"
      );
    }

    this.apiKey = apiKey;
    this.model = fields.model;
    this.input = fields.input ?? {};
    this.promptKey = fields.promptKey;
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

    if (this.promptKey === undefined) {
      const [modelString, versionString] = this.model.split(":");
      const version = await replicate.models.versions.get(
        modelString.split("/")[0],
        modelString.split("/")[1],
        versionString
      );
      const openapiSchema = version.openapi_schema;
      const inputProperties: { "x-order": number | undefined }[] =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (openapiSchema as any)?.components?.schemas?.Input?.properties;
      if (inputProperties === undefined) {
        this.promptKey = "prompt";
      } else {
        const sortedInputProperties = Object.entries(inputProperties).sort(
          ([_keyA, valueA], [_keyB, valueB]) => {
            const orderA = valueA["x-order"] || 0;
            const orderB = valueB["x-order"] || 0;
            return orderA - orderB;
          }
        );
        this.promptKey = sortedInputProperties[0][0] ?? "prompt";
      }
    }
    const output = await this.caller.callWithOptions(
      { signal: options.signal },
      () =>
        replicate.run(this.model, {
          input: {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            [this.promptKey!]: prompt,
            ...this.input,
          },
        })
    );

    if (typeof output === "string") {
      return output;
    } else if (Array.isArray(output)) {
      return output.join("");
    } else {
      // Note this is a little odd, but the output format is not consistent
      // across models, so it makes some amount of sense.
      return String(output);
    }
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
