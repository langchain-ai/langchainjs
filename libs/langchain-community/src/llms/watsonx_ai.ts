import {
  type BaseLLMCallOptions,
  type BaseLLMParams,
  LLM,
} from "@langchain/core/language_models/llms";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * The WatsonxAIParams interface defines the input parameters for
 * the WatsonxAI class.
 */
export interface WatsonxAIParams extends BaseLLMParams {
  /**
   * WatsonX AI Complete Endpoint.
   * Can be used if you want a fully custom endpoint.
   */
  endpoint?: string;
  /**
   * IBM Cloud Compute Region.
   * eg. us-south, us-east, etc.
   */
  region?: string;
  /**
   * WatsonX AI Version.
   * Date representing the WatsonX AI Version.
   * eg. 2023-05-29
   */
  version?: string;
  /**
   * WatsonX AI Key.
   * Provide API Key if you do not wish to automatically pull from env.
   */
  ibmCloudApiKey?: string;
  /**
   * WatsonX AI Key.
   * Provide API Key if you do not wish to automatically pull from env.
   */
  projectId?: string;
  /**
   * Parameters accepted by the WatsonX AI Endpoint.
   */
  modelParameters?: Record<string, unknown>;
  /**
   * WatsonX AI Model ID.
   */
  modelId?: string;
}

const endpointConstructor = (region: string, version: string) =>
  `https://${region}.ml.cloud.ibm.com/ml/v1-beta/generation/text?version=${version}`;

/**
 * The WatsonxAI class is used to interact with Watsonx AI
 * Inference Endpoint models. It uses IBM Cloud for authentication.
 * This requires your IBM Cloud API Key which is autoloaded if not specified.
 */

export class WatsonxAI extends LLM<BaseLLMCallOptions> {
  lc_serializable = true;

  static lc_name() {
    return "WatsonxAI";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      ibmCloudApiKey: "IBM_CLOUD_API_KEY",
      projectId: "WATSONX_PROJECT_ID",
    };
  }

  endpoint: string;

  region = "us-south";

  version = "2023-05-29";

  modelId = "meta-llama/llama-2-70b-chat";

  modelKwargs?: Record<string, unknown>;

  ibmCloudApiKey?: string;

  ibmCloudToken?: string;

  ibmCloudTokenExpiresAt?: number;

  projectId?: string;

  modelParameters?: Record<string, unknown>;

  constructor(fields: WatsonxAIParams) {
    super(fields);

    this.region = fields?.region ?? this.region;
    this.version = fields?.version ?? this.version;
    this.modelId = fields?.modelId ?? this.modelId;
    this.ibmCloudApiKey =
      fields?.ibmCloudApiKey ?? getEnvironmentVariable("IBM_CLOUD_API_KEY");
    this.projectId =
      fields?.projectId ?? getEnvironmentVariable("WATSONX_PROJECT_ID");

    this.endpoint =
      fields?.endpoint ?? endpointConstructor(this.region, this.version);
    this.modelParameters = fields.modelParameters;

    if (!this.ibmCloudApiKey) {
      throw new Error("Missing IBM Cloud API Key");
    }

    if (!this.projectId) {
      throw new Error("Missing WatsonX AI Project ID");
    }
  }

  _llmType() {
    return "watsonx_ai";
  }

  /**
   * Calls the WatsonX AI endpoint and retrieves the result.
   * @param {string} prompt The input prompt.
   * @returns {Promise<string>} A promise that resolves to the generated string.
   */
  /** @ignore */
  async _call(
    prompt: string,
    _options: this["ParsedCallOptions"]
  ): Promise<string> {
    interface WatsonxAIResponse {
      results: {
        generated_text: string;
        generated_token_count: number;
        input_token_count: number;
      }[];
      errors: {
        code: string;
        message: string;
      }[];
    }
    const response = (await this.caller.call(async () =>
      fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${await this.generateToken()}`,
        },
        body: JSON.stringify({
          project_id: this.projectId,
          model_id: this.modelId,
          input: prompt,
          parameters: this.modelParameters,
        }),
      }).then((res) => res.json())
    )) as WatsonxAIResponse;

    /**
     * Handle Errors for invalid requests.
     */
    if (response.errors) {
      throw new Error(response.errors[0].message);
    }

    return response.results[0].generated_text;
  }

  async generateToken(): Promise<string> {
    if (this.ibmCloudToken && this.ibmCloudTokenExpiresAt) {
      if (this.ibmCloudTokenExpiresAt > Date.now()) {
        return this.ibmCloudToken;
      }
    }

    interface TokenResponse {
      access_token: string;
      expiration: number;
    }

    const urlTokenParams = new URLSearchParams();
    urlTokenParams.append(
      "grant_type",
      "urn:ibm:params:oauth:grant-type:apikey"
    );
    urlTokenParams.append("apikey", this.ibmCloudApiKey as string);

    const data = (await fetch("https://iam.cloud.ibm.com/identity/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: urlTokenParams,
    }).then((res) => res.json())) as TokenResponse;

    this.ibmCloudTokenExpiresAt = data.expiration * 1000;
    this.ibmCloudToken = data.access_token;

    return this.ibmCloudToken;
  }
}
