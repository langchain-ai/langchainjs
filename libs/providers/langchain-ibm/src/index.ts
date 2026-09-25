// Re-export all types
export type {
  WatsonxAuth,
  WatsonxInit,
  Neverify,
  XOR,
  TokenUsage,
  WatsonxRequestBasicOptions,
  WatsonxChatBasicOptions,
  WatsonxLLMBasicOptions,
  WatsonxRerankBasicOptions,
  WatsonxEmbeddingsBasicOptions,
  WatsonxTooChoice,
  WatsonxBaseChatParams,
  GenerationInfo,
  ResponseChunk,
} from "./types.js";

// Re-export auth utilities
export { createAuthenticator, prepareInstanceConfig } from "./auth/index.js";
export type { InstanceConfig } from "./auth/index.js";

export {
  _isValidMistralToolCallId,
  _convertToolCallIdToMistralCompatible,
  WatsonxToolsOutputParser,
  jsonSchemaToZod,
  expectOneOf,
} from "./utils/ibm.js";

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
} from "./chat_models/ibm.js";

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
} from "./llms/ibm.js";

export {
  type WatsonxEmbeddingsParams,
  type WatsonxInputEmbeddings,
  type WatsonxEmbeddingsGatewayKwargs,
  type WatsonxEmbeddingsGatewayParams,
  type WatsonxInputGatewayEmbeddings,
  type WatsonxEmbeddingsConstructor,
  WatsonxEmbeddings,
} from "./embeddings/ibm.js";

export {
  type WatsonxInputRerank,
  WatsonxRerank,
} from "./document_compressors/ibm.js";

export {
  type WatsonxToolParams,
  WatsonxTool,
  WatsonxToolkit,
} from "./agents/toolkits/ibm.js";
