import { BaseLLMCallOptions, BaseLLMParams, LLM } from "./base.js";
import { getEnvironmentVariable } from "../util/env.js";

/**
 * The GradientxAIParams interface defines the input parameters for
 * the GradientxAI class.
 */
export interface GradientAIParams extends BaseLLMParams {
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
   * Parameters accepted by the WatsonX AI Endpoint.
   */
  inferenceParameters?: Record<string, unknown>;
  /**
   * Gradient AI Model Slug.
   */
  modelSlug?: string;
}

/**
 * The GradientAI class is used to interact with Gradient AI inference Endpoint models.
 * This requires your Gradient AI Access Token which is autoloaded if not specified.
 */

export class WatsonxAI extends LLM<BaseLLMCallOptions> {
  static lc_name() {
    return "GradientAI";
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

  constructor(fields: GradientAIParams) {
    super(fields);

    this.modelSlug = fields?.modelSlug ?? this.modelSlug;
    this.gradientAccessKey =
      fields?.gradientAccessKey ?? getEnvironmentVariable("GRADIENT_ACCESS_TOKEN");
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
    const response = (await this.caller.call(async () =>
      console.log('')
    ));


    return "test";
  }
}
