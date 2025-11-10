import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  type ChatGoogleVertexAIParams,
  ChatGoogleVertexAI,
  type ChatGoogleGenerativeAIParams,
  ChatGoogleGenerativeAI,
} from "./index.js";
import { getGoogleChatModelParams } from "./base.js";
import { GENERATIVE_AI_AUTH_SCOPES, VERTEX_AI_AUTH_SCOPES } from "../const.js";
import {
  ensureAuthScopes,
  NodeApiClient,
  NodeApiClientParams,
} from "../clients/node.js";

interface ChatGoogleGenerativeAINodeParams
  extends NodeApiClientParams,
    ChatGoogleGenerativeAIParams {}

class ChatGoogleGenerativeAINode extends ChatGoogleGenerativeAI {
  constructor(
    model: string,
    params?: Omit<ChatGoogleGenerativeAINodeParams, "model">
  );
  constructor(params: ChatGoogleGenerativeAINodeParams);
  constructor(
    modelOrParams: string | ChatGoogleGenerativeAINodeParams,
    paramsArg?: Omit<ChatGoogleGenerativeAINodeParams, "model">
  ) {
    const params = getGoogleChatModelParams(modelOrParams, paramsArg);
    if (!params.googleAuthOptions) {
      params.apiKey = params.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    }
    if (params.googleAuthOptions) {
      params.googleAuthOptions = ensureAuthScopes(
        params.googleAuthOptions,
        GENERATIVE_AI_AUTH_SCOPES
      );
    }
    const apiClient = params?.apiClient ?? new NodeApiClient(params);
    super({ ...params, apiClient });
  }
}

interface ChatGoogleVertexAINodeParams
  extends NodeApiClientParams,
    ChatGoogleVertexAIParams {}

class ChatGoogleVertexAINode extends ChatGoogleVertexAI {
  constructor(
    model: string,
    params?: Omit<ChatGoogleVertexAINodeParams, "model">
  );
  constructor(params: ChatGoogleVertexAINodeParams);
  constructor(
    modelOrParams: string | ChatGoogleVertexAINodeParams,
    paramsArg?: Omit<ChatGoogleVertexAINodeParams, "model">
  ) {
    const params = getGoogleChatModelParams(modelOrParams, paramsArg);
    if (!params.googleAuthOptions) {
      params.apiKey = params.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    }
    if (params.googleAuthOptions) {
      params.googleAuthOptions = ensureAuthScopes(
        params.googleAuthOptions,
        VERTEX_AI_AUTH_SCOPES
      );
    }
    const apiClient = params?.apiClient ?? new NodeApiClient(params);
    super({ ...params, apiClient });
  }
}

export {
  type ChatGoogleVertexAINodeParams as ChatGoogleVertexAIParams,
  ChatGoogleVertexAINode as ChatGoogleVertexAI,
  type ChatGoogleGenerativeAINodeParams as ChatGoogleGenerativeAIParams,
  ChatGoogleGenerativeAINode as ChatGoogleGenerativeAI,
};
