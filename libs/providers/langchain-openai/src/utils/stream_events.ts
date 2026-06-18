/**
 * Converts a raw OpenAI Chat Completions SSE chunk stream into LangChain
 * {@link ChatModelStreamEvent}s.
 *
 * @module
 */

export {
  convertOpenAICompletionsStream,
  type ConvertOpenAICompletionsStreamOptions,
  type OpenAICompletionsStreamChunk,
  type OpenAICompletionsDelta,
  type OpenAICompletionsStreamChoice,
  type OpenAICompletionsUsage,
  type OpenAICompletionsFinishReason,
  type OpenAICompletionsToolCallDelta,
} from "@langchain/core/language_models/openai_completions_stream";
