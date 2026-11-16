import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { WebApiClient } from "../clients/index.js";
import { applyGeminiGatewayParams } from "../utils/connection.js";
import {
  BaseGoogleClassifier,
  normalizeGoogleClassifierParams,
} from "./base.js";
import type {
  BaseGoogleClassifierParams,
  GoogleClassifierFields,
  GoogleClassifierParams,
  GoogleDecisions,
} from "./types.js";

/**
 * Google Gemini Decisions model (for example, `"gemini-decision-1"`) for web,
 * edge, and Node.js environments using API keys or GCP service account credentials.
 *
 * Import from `@langchain/google/node` when authenticating with Application
 * Default Credentials (ADC) or `google-auth-library` `googleAuthOptions`.
 *
 * @example
 * ```ts
 * import { GoogleClassifier } from "@langchain/google";
 *
 * const classifier = new GoogleClassifier("gemini-decision-1");
 * const result = await classifier.invoke({
 *   state: "The blue mug I ordered on Monday arrived cracked on Wednesday.",
 *   questions: {
 *     is_damaged: {
 *       type: "noul",
 *       instructions: "Did the item arrive damaged?",
 *     },
 *   },
 * });
 * console.log(result.nouls.is_damaged.noul);
 * ```
 */
export class GoogleClassifier extends BaseGoogleClassifier {
  declare protected apiKey?: string;

  constructor(model: string, params?: Omit<GoogleClassifierParams, "model">);
  constructor(params: GoogleClassifierParams);
  constructor(
    modelOrParams: string | GoogleClassifierParams,
    paramsArg?: Omit<GoogleClassifierParams, "model">
  ) {
    let params = normalizeGoogleClassifierParams(modelOrParams, paramsArg);
    params = applyGeminiGatewayParams(params);
    params.apiKey = params.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    const apiClient = params.apiClient ?? new WebApiClient(params);
    super({ ...params, apiClient });

    Object.defineProperty(this, "apiKey", {
      value: params.apiKey,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
}

export {
  BaseGoogleClassifier,
  type BaseGoogleClassifierParams,
  type GoogleClassifierFields,
  type GoogleClassifierParams,
  type GoogleDecisions,
};
