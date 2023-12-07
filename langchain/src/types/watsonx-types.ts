import { BaseLanguageModelParams } from "@langchain/core/language_models/base";

export interface WatsonModelParameters {
  decoding_method?: "sample" | "greedy";
  max_new_tokens?: number;
  min_new_tokens?: number;
  stop_sequences?: string[];
  temperature?: number;
  top_k?: number;
  top_p?: number;
  repetition_penalty?: number;
}

export interface WatsonApiClientSettings {
  /**
   * IBM Cloud Compute Region.
   * eg. us-south, us-east, etc.
   */
  region?: string;

  /**
   * WatsonX AI Key.
   * Provide API Key if you do not wish to automatically pull from env.
   */
  apiKey?: string;

  /**
   * WatsonX AI Version.
   * Date representing the WatsonX AI Version.
   * eg. 2023-05-29
   */
  apiVersion?: string;
}

/**
 * The WatsonxAIParams interface defines the input parameters for
 * the WatsonxAI class.
 */
export interface WatsonxAIParams extends BaseLanguageModelParams {
  /**
   * WatsonX AI Key.
   * Provide API Key if you do not wish to automatically pull from env.
   */
  projectId?: string;
  /**
   * Parameters accepted by the WatsonX AI Endpoint.
   */
  modelParameters?: WatsonModelParameters;
  /**
   * WatsonX AI Model ID.
   */
  modelId?: string;

  /**
   * Watson rest api client config
   */
  clientConfig?: WatsonApiClientSettings;
}
