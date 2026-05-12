// Re-export all types
export type {
  WatsonxAuth,
  WatsonxInit,
  TokenUsage,
  WatsonxRequestBasicOptions,
  WatsonxChatBasicOptions,
  WatsonxLLMBasicOptions,
  WatsonxRerankBasicOptions,
  WatsonxEmbeddingsBasicOptions,
  WatsonxToolChoice,
  WatsonxBaseChatParams,
  GenerationInfo,
  ResponseChunk,
} from "./types.js";

// Re-export error classes
export {
  WatsonxError,
  WatsonxAuthenticationError,
  WatsonxValidationError,
  WatsonxConfigurationError,
  WatsonxUnsupportedOperationError,
} from "./types.js";

// Re-export auth utilities
export { createAuthenticator, prepareInstanceConfig } from "./auth/index.js";
export type { InstanceConfig } from "./auth/index.js";

export {
  _isValidMistralToolCallId,
  _convertToolCallIdToMistralCompatible,
} from "./utils/tool-call-id.js";

export {
  expectOneOf,
  checkValidProps,
  PropertyValidator,
} from "./utils/validation.js";

export { jsonSchemaToZod } from "./utils/schema.js";

export { WatsonxToolsOutputParser } from "./utils/parsers.js";

export {
  type ChatWatsonxInput,
  type ChatWatsonxDeployedInput,
  type ChatWatsonxGatewayInput,
  type ChatWatsonxConstructorInput,
  type ChatWatsonxCallOptions,
  type ChatWatsonxConstructor,
  type WatsonxCallParams,
  type WatsonxCallDeployedParams,
  type WatsonxDeltaStream,
  type WatsonxCallOptionsChat,
  type WatsonxProjectSpaceParams,
  type WatsonxCallOptionsDeployedChat,
  type WatsonxDeployedParams,
  type WatsonxGatewayChatKwargs,
  type WatsonxCallOptionsGatewayChat,
  type WatsonxGatewayChatParams,
  ChatWatsonx,
} from "./chat_models/index.js";

export {
  type WatsonxLLMParams,
  type WatsonxDeploymentLLMParams,
  type WatsonxLLMGatewayParams,
  type WatsonxCallOptionsLLM,
  type WatsonxInputLLM,
  type WatsonxDeployedInputLLM,
  type WatsonxGatewayInputLLM,
  type WatsonxLLMConstructor,
  WatsonxLLM,
} from "./llms/index.js";

export {
  type WatsonxEmbeddingsParams,
  type WatsonxInputEmbeddings,
  type WatsonxEmbeddingsGatewayKwargs,
  type WatsonxEmbeddingsGatewayParams,
  type WatsonxInputGatewayEmbeddings,
  type WatsonxEmbeddingsConstructor,
  WatsonxEmbeddings,
} from "./embeddings/index.js";

export {
  type WatsonxInputRerank,
  WatsonxRerank,
} from "./document_compressors/index.js";

export {
  type WatsonxToolParams,
  WatsonxTool,
  WatsonxToolkit,
} from "./agents/toolkits/index.js";
