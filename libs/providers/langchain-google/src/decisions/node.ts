import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  ensureAuthScopes,
  NodeApiClient,
  type NodeApiClientParams,
} from "../clients/node.js";
import {
  applyGeminiGatewayParams,
  getRequiredAuthScopes,
} from "../utils/connection.js";
import {
  BaseGoogleClassifier,
  DEFAULT_DECISIONS_MODEL,
  normalizeGoogleClassifierParams,
} from "./base.js";
import type {
  BaseGoogleClassifierParams,
  GoogleClassifierFields,
  GoogleDecisions,
} from "./types.js";

export interface GoogleClassifierNodeParams
  extends BaseGoogleClassifierParams, NodeApiClientParams {}

class GoogleClassifierNode extends BaseGoogleClassifier {
  declare protected apiKey?: string;

  constructor(params?: GoogleClassifierNodeParams);
  constructor(
    model: string,
    params?: Omit<GoogleClassifierNodeParams, "model">
  );
  constructor(
    modelOrParams?: string | GoogleClassifierNodeParams,
    paramsArg?: Omit<GoogleClassifierNodeParams, "model">
  ) {
    let params = normalizeGoogleClassifierParams(modelOrParams, paramsArg);
    params = applyGeminiGatewayParams(params);
    params.apiKey = params.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    const requiredScopes = getRequiredAuthScopes(params);
    const usesImplicitGoogleAuth =
      !params.apiClient &&
      !params.apiKey &&
      !params.credentials &&
      !getEnvironmentVariable("GOOGLE_CLOUD_CREDENTIALS");
    if (params.googleAuthOptions || usesImplicitGoogleAuth) {
      params.googleAuthOptions = ensureAuthScopes(
        params.googleAuthOptions ?? {},
        requiredScopes
      );
    }
    const apiClient = params.apiClient ?? new NodeApiClient(params);
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
  DEFAULT_DECISIONS_MODEL,
  GoogleClassifierNode as GoogleClassifier,
  type BaseGoogleClassifierParams,
  type GoogleClassifierFields,
  type GoogleClassifierNodeParams as GoogleClassifierParams,
  type GoogleDecisions,
};
