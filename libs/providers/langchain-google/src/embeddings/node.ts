import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { GoogleEmbeddingsParams } from "./index.js";
import {
  BaseGoogleEmbeddings,
  getGoogleEmbeddingsParams,
} from "./base.js";
import { GENERATIVE_AI_AUTH_SCOPES, VERTEX_AI_AUTH_SCOPES } from "../const.js";
import {
  ensureAuthScopes,
  NodeApiClient,
  NodeApiClientParams,
} from "../clients/node.js";
import { convertParamsToPlatformType } from "../converters/params.js";
import { getPlatformType } from "../utils/platform.js";

interface GoogleEmbeddingsNodeParams extends NodeApiClientParams, GoogleEmbeddingsParams {}

class GoogleEmbeddingsNode extends BaseGoogleEmbeddings {
  constructor(model: string, params?: Omit<GoogleEmbeddingsNodeParams, "model">);
  constructor(params: GoogleEmbeddingsNodeParams);
  constructor(
    modelOrParams: string | GoogleEmbeddingsNodeParams,
    paramsArg?: Omit<GoogleEmbeddingsNodeParams, "model">
  ) {
    const params = getGoogleEmbeddingsParams(modelOrParams, paramsArg);
    if (!params.googleAuthOptions) {
      params.apiKey = params.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    }
    const requiredScopes: string[] = getRequiredAuthScopes(params);
    if (params.googleAuthOptions) {
      params.googleAuthOptions = ensureAuthScopes(
        params.googleAuthOptions,
        requiredScopes
      );
    }
    const apiClient = params?.apiClient ?? new NodeApiClient(params);
    super({ ...params, apiClient });
  }
}

function getRequiredAuthScopes(params: GoogleEmbeddingsNodeParams): string[] {
  const hasApiKey = typeof params.apiKey !== "undefined";
  const platformType = convertParamsToPlatformType(params);
  const platform = getPlatformType(platformType, hasApiKey);
  switch (platform) {
    case "gai":
      return GENERATIVE_AI_AUTH_SCOPES;
    case "gcp":
      return VERTEX_AI_AUTH_SCOPES;
    default:
      return VERTEX_AI_AUTH_SCOPES;
  }
}

export {
  type GoogleEmbeddingsNodeParams as GoogleEmbeddingsParams,
  GoogleEmbeddingsNode as GoogleEmbeddings,
};
