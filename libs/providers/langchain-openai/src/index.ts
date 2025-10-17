export { OpenAI as OpenAIClient, type ClientOptions, toFile } from "openai";

export {
  type BaseChatOpenAICallOptions,
  type BaseChatOpenAIFields,
  BaseChatOpenAI,
} from "./chat_models/base.js";
export {
  type ChatOpenAIResponsesCallOptions,
  ChatOpenAIResponses,
} from "./chat_models/responses.js";
export {
  type ChatOpenAICompletionsCallOptions,
  ChatOpenAICompletions,
} from "./chat_models/completions.js";
export {
  type OpenAICallOptions,
  type OpenAIChatInput,
  type ChatOpenAICallOptions,
  type ChatOpenAIFields,
  ChatOpenAI,
} from "./chat_models/index.js";

export { type AzureChatOpenAIFields } from "./azure/chat_models/common.js";
export { AzureChatOpenAICompletions } from "./azure/chat_models/completions.js";
export { AzureChatOpenAIResponses } from "./azure/chat_models/responses.js";
export { AzureChatOpenAI } from "./azure/chat_models/index.js";

export * from "./llms.js";
export * from "./azure/llms.js";
export * from "./azure/embeddings.js";
export * from "./embeddings.js";
export * from "./types.js";
export * from "./utils/client.js";
export * from "./utils/azure.js";
export * from "./tools/index.js";
export { customTool } from "./tools/custom.js";
export { convertPromptToOpenAI } from "./utils/prompts.js";

// These methods are used in LangSmith, export is important here
// TODO: put this conversion elsewhere
export { _convertMessagesToOpenAIParams } from "./utils/message_inputs.js";
export { messageToOpenAIRole } from "./utils/misc.js";
