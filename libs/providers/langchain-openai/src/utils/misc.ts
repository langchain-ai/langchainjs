import type { OpenAI as OpenAIClient } from "openai";
import { BaseMessage, ChatMessage } from "@langchain/core/messages";

export const iife = <T>(fn: () => T) => fn();

export function isReasoningModel(model?: string) {
  if (!model) return false;
  if (/^o\d/.test(model ?? "")) return true;
  if (model.startsWith("gpt-5") && !model.startsWith("gpt-5-chat")) return true;
  return false;
}

export function extractGenericMessageCustomRole(message: ChatMessage) {
  if (
    message.role !== "system" &&
    message.role !== "developer" &&
    message.role !== "assistant" &&
    message.role !== "user" &&
    message.role !== "function" &&
    message.role !== "tool"
  ) {
    console.warn(`Unknown message role: ${message.role}`);
  }

  return message.role as OpenAIClient.ChatCompletionRole;
}

export function messageToOpenAIRole(
  message: BaseMessage
): OpenAIClient.ChatCompletionRole {
  const type = message._getType();
  switch (type) {
    case "system":
      return "system";
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "function":
      return "function";
    case "tool":
      return "tool";
    case "generic": {
      if (!ChatMessage.isInstance(message))
        throw new Error("Invalid generic chat message");
      return extractGenericMessageCustomRole(message);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}
