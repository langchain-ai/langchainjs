import { BaseLLMCallOptions, BaseLLMParams, LLM } from "./base.js";
import { getEnvironmentVariable } from "../util/env.js";

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
   * Parameters accepted by the WatsonX AI Endpoint.
   */
  endpointOptions?: Record<string, unknown>;
}


const endpointConstructor = (region: string, version: string) => {
  return `https://${region}.ml.cloud.ibm.com/ml/v1-beta/generation/text?version=${version}`
};

/**
 * The WatsonxAI class is used to interact with Watsonx AI
 * Inference Endpoint models. It uses IBM Cloud for authentication.
 * This requires your IBM Cloud API Key which is autoloaded if not specified.
 */

export class WatsonxAI extends LLM<BaseLLMCallOptions> {
  static lc_name() {
    return "WatsonxAI";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      ibmCloudApiKey: "IBM_CLOUD_API_KEY",
    };
  }

  endpoint: string;

  region = "us-south";

  version = "2023-05-29";

  modelKwargs?: Record<string, unknown>;

  ibmCloudApiKey?: string;

  endpointOptions?: Record<string, unknown>;

  constructor(fields: WatsonxAIParams) {
    super(fields);

    this.region = fields?.region ?? this.region;
    this.version = fields?.version ?? this.version;
    this.ibmCloudApiKey = fields?.ibmCloudApiKey ?? getEnvironmentVariable("IBM_CLOUD_API_KEY");

    this.endpoint = fields?.endpoint ?? endpointConstructor(this.region, this.version);
    this.endpointOptions = fields.endpointOptions;
  }

  _llmType() {
    return "WatsonxAI";
  }

  /**
   * Calls the WatsonX AI endpoint and retrieves the result.
   * @param {string} prompt The input prompt.
   * @param {this["ParsedCallOptions"]} options Parsed call options.
   * @param {CallbackManagerForLLMRun} runManager Optional run manager.
   * @returns {Promise<string>} A promise that resolves to the generated string.
   */
  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"],
  ): Promise<string> {
    // const response = await this.caller.call(() =>
    //   // Send request to WatsonX AI endpoint
    // );
    console.log(prompt, options)
    return "test";
  }
}
