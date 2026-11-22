import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { ChatGoogleParams } from "./index.js";
import { applyGeminiGatewayParams, BaseChatGoogle } from "./base.js";
import { getGoogleChatModelParams } from "../converters/shared/params.js";
import { getRequiredAuthScopes } from "../utils/connection.js";
import {
  ensureAuthScopes,
  NodeApiClient,
  NodeApiClientParams,
} from "../clients/node.js";

interface ChatGoogleNodeParams extends NodeApiClientParams, ChatGoogleParams {}

class ChatGoogleNode extends BaseChatGoogle {
  constructor(model: string, params?: Omit<ChatGoogleNodeParams, "model">);
  constructor(params: ChatGoogleNodeParams);
  constructor(
    modelOrParams: string | ChatGoogleNodeParams,
    paramsArg?: Omit<ChatGoogleNodeParams, "model">
  ) {
    let params = getGoogleChatModelParams(modelOrParams, paramsArg);
    params = applyGeminiGatewayParams(params);
    params.apiKey = params.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    const requiredScopes: string[] = getRequiredAuthScopes(params);
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
    const apiClient = params?.apiClient ?? new NodeApiClient(params);
    super({ ...params, apiClient });
  }
}

export {
  type ChatGoogleNodeParams as ChatGoogleParams,
  ChatGoogleNode as ChatGoogle,
};
