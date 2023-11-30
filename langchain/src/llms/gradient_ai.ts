import { Gradient } from "@gradientai/nodejs-sdk";
import { BaseLLMCallOptions, BaseLLMParams, LLM } from "./base.js";
import { getEnvironmentVariable } from "../util/env.js";

/**
 * The GradientLLMParams interface defines the input parameters for
 * the GradientLLM class.
 */
export interface GradientLLMParams extends BaseLLMParams {
  /**
   * Gradient AI Access Token.
   * Provide Access Token if you do not wish to automatically pull from env.
   */
  gradientAccessKey?: string;
  /**
   * Gradient Workspace Id.
   * Provide workspace id if you do not wish to automatically pull from env.
   */
  workspaceId?: string;
  /**
   * Parameters accepted by the Gradient npm package.
   */
  inferenceParameters?: Record<string, unknown>;
  /**
   * Gradient AI Model Slug.
   */
  modelSlug?: string;
}

/**
 * The GradientLLM class is used to interact with Gradient AI inference Endpoint models.
 * This requires your Gradient AI Access Token which is autoloaded if not specified.
 */
export class GradientLLM extends LLM<BaseLLMCallOptions> {
  static lc_name() {
    return "GradientLLM";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      gradientAccessKey: "GRADIENT_ACCESS_TOKEN",
      workspaceId: "GRADIENT_WORKSPACE_ID",
    };
  }

  modelSlug = "llama2-7b-chat";

  gradientAccessKey?: string;

  workspaceId?: string;

  inferenceParameters?: Record<string, unknown>;

  // Gradient AI does not export the BaseModel type. Once it does, we can use it here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  baseModel: any;

  constructor(fields: GradientLLMParams) {
    super(fields);

    this.modelSlug = fields?.modelSlug ?? this.modelSlug;
    this.gradientAccessKey =
      fields?.gradientAccessKey ??
      getEnvironmentVariable("GRADIENT_ACCESS_TOKEN");
    this.workspaceId =
      fields?.workspaceId ?? getEnvironmentVariable("GRADIENT_WORKSPACE_ID");

    this.inferenceParameters = fields.inferenceParameters;

    if (!this.gradientAccessKey) {
      throw new Error("Missing Gradient AI Access Token");
    }

    if (!this.workspaceId) {
      throw new Error("Missing Gradient AI Workspace ID");
    }
  }

  _llmType() {
    return "gradient_ai";
  }

  /**
   * Calls the Gradient AI endpoint and retrieves the result.
   * @param {string} prompt The input prompt.
   * @returns {Promise<string>} A promise that resolves to the generated string.
   */
  /** @ignore */
  async _call(
    prompt: string,
    _options: this["ParsedCallOptions"]
  ): Promise<string> {
    await this.setBaseModel();

    // GradientLLM does not export the CompleteResponse type. Once it does, we can use it here.
    interface CompleteResponse {
      finishReason: string;
      generatedOutput: string;
    }

    const response = (await this.caller.call(async () =>
      this.baseModel.complete({
        query: prompt,
        ...this.inferenceParameters,
      })
    )) as CompleteResponse;

    return response.generatedOutput;
  }

  async setBaseModel() {
    if (this.baseModel) return;

    const gradient = new Gradient({
      accessToken: this.gradientAccessKey,
      workspaceId: this.workspaceId,
    });
    this.baseModel = await gradient.getBaseModel({
      baseModelSlug: this.modelSlug,
    });
  }
}
