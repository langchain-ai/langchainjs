import type { BaseLLMParams } from "@langchain/core/language_models/llms";
import { isModelGemini, validateGeminiParams } from "./gemini.js";

/**
 * Parameters needed to setup the client connection.
 * AuthOptions are something like GoogleAuthOptions (from google-auth-library)
 * or WebGoogleAuthOptions.
 */
export interface GoogleClientParams<AuthOptions> {
  authOptions?: AuthOptions;

  /** Some APIs allow an API key instead */
  apiKey?: string;
}

/**
 * What platform is this running on?
 * gai - Google AI Studio / MakerSuite / Generative AI platform
 * gcp - Google Cloud Platform
 */
export type GooglePlatformType = "gai" | "gcp";

export interface GoogleConnectionParams<AuthOptions>
  extends GoogleClientParams<AuthOptions> {
  /** Hostname for the API call (if this is running on GCP) */
  endpoint?: string;

  /** Region where the LLM is stored (if this is running on GCP) */
  location?: string;

  /** The version of the API functions. Part of the path. */
  apiVersion?: string;

  /**
   * What platform to run the service on.
   * If not specified, the class should determine this from other
   * means. Either way, the platform actually used will be in
   * the "platform" getter.
   */
  platformType?: GooglePlatformType;
}

export interface GoogleAISafetySetting {
  category: string;
  threshold: string;
}

export interface GoogleAIModelParams {
  /** Model to use */
  model?: string;

  /** Sampling temperature to use */
  temperature?: number;

  /**
   * Maximum number of tokens to generate in the completion.
   */
  maxOutputTokens?: number;

  /**
   * Top-p changes how the model selects tokens for output.
   *
   * Tokens are selected from most probable to least until the sum
   * of their probabilities equals the top-p value.
   *
   * For example, if tokens A, B, and C have a probability of
   * .3, .2, and .1 and the top-p value is .5, then the model will
   * select either A or B as the next token (using temperature).
   */
  topP?: number;

  /**
   * Top-k changes how the model selects tokens for output.
   *
   * A top-k of 1 means the selected token is the most probable among
   * all tokens in the model’s vocabulary (also called greedy decoding),
   * while a top-k of 3 means that the next token is selected from
   * among the 3 most probable tokens (using temperature).
   */
  topK?: number;

  stopSequences?: string[];

  safetySettings?: GoogleAISafetySetting[];
}

export function copyAIModelParams(
  params: GoogleAIModelParams | undefined
): GoogleAIModelParams {
  return copyAIModelParamsInto(params, {});
}

export function copyAIModelParamsInto(
  params: GoogleAIModelParams | undefined,
  target: GoogleAIModelParams
): GoogleAIModelParams {
  const ret: GoogleAIModelParams = target || {};

  ret.model = params?.model ?? target.model;

  ret.temperature = params?.temperature ?? target.temperature;
  ret.maxOutputTokens = params?.maxOutputTokens ?? target.maxOutputTokens;
  ret.topP = params?.topP ?? target.topP;
  ret.topK = params?.topK ?? target.topK;
  ret.stopSequences = params?.stopSequences ?? target.stopSequences;
  ret.safetySettings = params?.safetySettings ?? target.safetySettings;

  return ret;
}

export function validateModelParams(
  params: GoogleAIModelParams | undefined
): void {
  const testParams: GoogleAIModelParams = params ?? {};
  switch (modelToFamily(testParams.model)) {
    case "gemini":
      return validateGeminiParams(testParams);
    default:
      throw new Error(
        `Unable to verify model params: ${JSON.stringify(params)}`
      );
  }
}

export function copyAndValidateModelParamsInto(
  params: GoogleAIModelParams | undefined,
  target: GoogleAIModelParams
): GoogleAIModelParams {
  copyAIModelParamsInto(params, target);
  validateModelParams(target);
  return target;
}

export interface GoogleAIBaseLLMInput<AuthOptions>
  extends BaseLLMParams,
    GoogleConnectionParams<AuthOptions>,
    GoogleAIModelParams {}

export interface GoogleResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export type GoogleLLMModelFamily = null | "palm" | "gemini";

export function modelToFamily(
  modelName: string | undefined
): GoogleLLMModelFamily {
  if (!modelName) {
    return null;
  } else if (isModelGemini(modelName)) {
    return "gemini";
  } else {
    return null;
  }
}
