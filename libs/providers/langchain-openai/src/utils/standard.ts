import type { OpenAI as OpenAIClient } from "openai";
import type { AIMessage } from "@langchain/core/messages";

export function _convertToCompletionsMessageFromV1(
  message: AIMessage
): OpenAIClient.Chat.Completions.ChatCompletionMessageParam {}

export function _convertToResponsesMessageFromV1(
  message: AIMessage
): OpenAIClient.Responses.ResponseInputItem {}
