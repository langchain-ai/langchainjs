export {
  type SerializedLLM,
  type BaseLangChainParams,
  BaseLangChain,
  type BaseLanguageModelParams,
  type BaseLanguageModelCallOptions,
  type BaseFunctionCallOptions,
  type BaseLanguageModelInput,
  BaseLanguageModel,
} from "@langchain/core/language_models/base";

/*
 * Export utility functions for token calculations:
 * - calculateMaxTokens: Calculate max tokens for a given model and prompt (the model context size - tokens in prompt).
 * - getModelContextSize: Get the context size for a specific model.
 */
export { calculateMaxTokens, getModelContextSize } from "./count_tokens.js";
