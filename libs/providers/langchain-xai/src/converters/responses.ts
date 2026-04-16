import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  type UsageMetadata,
} from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";

import type {
  XAIResponse,
  XAIResponsesInputItem,
  XAIResponsesMessage,
  XAIResponsesOutputContent,
  XAIResponsesOutputItem,
  XAIResponsesStreamEvent,
  XAIResponsesUsage,
} from "../chat_models/responses-types.js";

// ============================================================================
// Message Converters
// ============================================================================

/**
 * Converts a single LangChain BaseMessage to xAI Responses API input format.
 *
 * @param message - The LangChain message to convert
 * @returns The xAI Responses API input item
 */
export function convertMessageToResponsesInput(
  message: BaseMessage
): XAIResponsesInputItem {
  if (message.type === "human") {
    const content =
      typeof message.content === "string"
        ? message.content
        : message.content.map((part) => {
            if (typeof part === "string") {
              return { type: "input_text" as const, text: part };
            }
            if (part.type === "text") {
              return { type: "input_text" as const, text: part.text };
            }
            if (part.type === "image_url") {
              const imageUrlPart = part as {
                type: "image_url";
                image_url: string | { url: string };
              };
              const imageUrl =
                typeof imageUrlPart.image_url === "string"
                  ? imageUrlPart.image_url
                  : imageUrlPart.image_url.url;
              return {
                type: "input_image" as const,
                image_url: imageUrl,
                detail: "auto" as const,
              };
            }
            return { type: "input_text" as const, text: "" };
          });

    return {
      role: "user",
      content,
    } as XAIResponsesMessage;
  }

  if (message.type === "system") {
    return {
      role: "system",
      content:
        typeof message.content === "string"
          ? message.content
          : message.content
              .map((part) =>
                typeof part === "string" ? part : part.text || ""
              )
              .join(""),
    } as XAIResponsesMessage;
  }

  if (message.type === "ai") {
    const aiMessage = message as AIMessage;
    return {
      type: "message",
      role: "assistant",
      text: typeof aiMessage.content === "string" ? aiMessage.content : "",
    } as unknown as XAIResponsesInputItem;
  }

  // Default fallback
  return {
    role: "user",
    content:
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content),
  } as XAIResponsesMessage;
}

/**
 * Converts an array of LangChain BaseMessages to xAI Responses API input format.
 *
 * @param messages - Array of LangChain messages to convert
 * @returns Array of xAI Responses API input items
 */
export function convertMessagesToResponsesInput(
  messages: BaseMessage[]
): XAIResponsesInputItem[] {
  return messages.map(convertMessageToResponsesInput);
}

// ============================================================================
// Usage Converters
// ============================================================================

/**
 * Converts xAI usage statistics to LangChain UsageMetadata format.
 *
 * @param usage - The xAI usage statistics
 * @returns LangChain UsageMetadata object
 */
export function convertUsageToUsageMetadata(
  usage: XAIResponsesUsage | null | undefined
): UsageMetadata {
  return {
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
    input_token_details: {
      ...(usage?.input_tokens_details?.cached_tokens != null && {
        cache_read: usage.input_tokens_details.cached_tokens,
      }),
    },
    output_token_details: {
      ...(usage?.output_tokens_details?.reasoning_tokens != null && {
        reasoning: usage.output_tokens_details.reasoning_tokens,
      }),
    },
  };
}

// ============================================================================
// Output Converters
// ============================================================================

/**
 * Extracts text content from xAI response output items.
 *
 * @param output - Array of xAI response output items
 * @returns Concatenated text content
 */
export function extractTextFromOutput(
  output: XAIResponsesOutputItem[]
): string {
  const textParts: string[] = [];

  for (const item of output) {
    if (item.type === "message" && "content" in item) {
      for (const contentItem of item.content as XAIResponsesOutputContent[]) {
        if (contentItem.type === "output_text") {
          textParts.push(contentItem.text);
        }
      }
    }
  }

  return textParts.join("");
}

/**
 * Converts an xAI Response to a LangChain AIMessage.
 *
 * @param response - The xAI API response
 * @returns LangChain AIMessage
 */
export function convertResponseToAIMessage(response: XAIResponse): AIMessage {
  const text = extractTextFromOutput(response.output);

  const responseMetadata: Record<string, unknown> = {
    model_provider: "xai",
    model: response.model,
    created_at: response.created_at,
    id: response.id,
    status: response.status,
    object: response.object,
  };

  if (response.incomplete_details) {
    responseMetadata.incomplete_details = response.incomplete_details;
  }

  return new AIMessage({
    content: text,
    usage_metadata: convertUsageToUsageMetadata(response.usage),
    response_metadata: responseMetadata,
    additional_kwargs: {
      ...(response.reasoning && { reasoning: response.reasoning }),
    },
  });
}

// ============================================================================
// Streaming Converters
// ============================================================================

/**
 * Converts an xAI streaming event to a LangChain ChatGenerationChunk.
 *
 * @param event - The xAI streaming event
 * @returns ChatGenerationChunk or null if the event doesn't produce a chunk
 */
export function convertStreamEventToChunk(
  event: XAIResponsesStreamEvent
): ChatGenerationChunk | null {
  const responseMetadata: Record<string, unknown> = {
    model_provider: "xai",
  };

  if (event.type === "response.output_text.delta") {
    return new ChatGenerationChunk({
      text: event.delta,
      message: new AIMessageChunk({
        content: event.delta,
        response_metadata: responseMetadata,
      }),
    });
  }

  if (event.type === "response.created") {
    responseMetadata.id = event.response.id;
    responseMetadata.model = event.response.model;
    return new ChatGenerationChunk({
      text: "",
      message: new AIMessageChunk({
        content: "",
        response_metadata: responseMetadata,
      }),
    });
  }

  if (event.type === "response.completed") {
    const aiMessage = convertResponseToAIMessage(event.response);
    return new ChatGenerationChunk({
      text: "",
      message: new AIMessageChunk({
        content: "",
        usage_metadata: aiMessage.usage_metadata,
        response_metadata: {
          ...responseMetadata,
          ...aiMessage.response_metadata,
        },
      }),
    });
  }

  return null;
}
