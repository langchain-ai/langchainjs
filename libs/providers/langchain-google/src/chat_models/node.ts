import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { ChatGoogleParams } from "./index.js";
import {
  BaseChatGoogle,
  getGoogleChatModelParams,
  getPlatformType,
} from "./base.js";
import { GENERATIVE_AI_AUTH_SCOPES, VERTEX_AI_AUTH_SCOPES } from "../const.js";
import {
  ensureAuthScopes,
  NodeApiClient,
  NodeApiClientParams,
} from "../clients/node.js";
import { convertParamsToPlatformType } from "../converters/params.js";

interface ChatGoogleNodeParams extends NodeApiClientParams, ChatGoogleParams {}

class ChatGoogleNode extends BaseChatGoogle {
  constructor(model: string, params?: Omit<ChatGoogleNodeParams, "model">);
  constructor(params: ChatGoogleNodeParams);
  constructor(
    modelOrParams: string | ChatGoogleNodeParams,
    paramsArg?: Omit<ChatGoogleNodeParams, "model">
  ) {
    const params = getGoogleChatModelParams(modelOrParams, paramsArg);
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

function getRequiredAuthScopes(params: ChatGoogleNodeParams): string[] {
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
  type ChatGoogleNodeParams as ChatGoogleParams,
  ChatGoogleNode as ChatGoogle,
};
