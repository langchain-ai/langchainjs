/**
 * Shared interface for token usage
 * return type from LLM calls.
 */
export interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}
