import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  ToolMessage,
  ToolCallChunk,
  UsageMetadata,
} from "@langchain/core/messages";
import {
  convertLangChainToolCallToOpenAI,
  parseToolCall,
  makeInvalidToolCall,
} from "@langchain/core/output_parsers/openai_tools";
import type { OpenRouter } from "../api-types.js";

/**
 * The inner data shape of a streaming SSE chunk. Each parsed SSE event
 * contains this object directly (without the `data` wrapper that the
 * OpenAPI spec describes on `ChatStreamingResponseChunk`).
 */
export type StreamingChunkData = OpenRouter.ChatStreamingResponseChunk["data"];

/**
 * Content part types we build when converting outbound messages.
 */
type ContentPart =
  | OpenRouter.ChatMessageContentItemText
  | OpenRouter.ChatMessageContentItemImage;

// ---------------------------------------------------------------------------
// LangChain → OpenRouter
// ---------------------------------------------------------------------------

function messageToRole(
  message: BaseMessage
): "user" | "assistant" | "system" | "tool" {
  const type = message._getType();
  switch (type) {
    case "system":
      return "system";
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "tool":
      return "tool";
    case "generic": {
      if (ChatMessage.isInstance(message)) {
        const role = message.role.toLowerCase();
        if (role === "assistant" || role === "ai") return "assistant";
        if (role === "system") return "system";
        if (role === "tool") return "tool";
      }
      return "user";
    }
    default:
      return "user";
  }
}

function contentToOpenRouterParts(
  content: BaseMessage["content"]
): string | ContentPart[] {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const parts: ContentPart[] = [];
  for (const block of content) {
    if (typeof block === "string") {
      parts.push({ type: "text", text: block });
    } else if (block.type === "text") {
      parts.push({
        type: "text",
        text: (block as { text: string }).text,
      });
    } else if (block.type === "image_url") {
      const imageUrl = (block as { image_url: string | { url: string } })
        .image_url;
      const url = typeof imageUrl === "string" ? imageUrl : imageUrl.url;
      parts.push({ type: "image_url", image_url: { url } });
    }
  }
  return parts.length > 0 ? parts : "";
}

/**
 * Convert an array of LangChain messages to the OpenRouter request format.
 *
 * The generated `OpenRouter.Message` is an empty placeholder (it's a
 * `oneOf` union in the spec). We build concrete message objects and
 * return them cast to `OpenRouter.Message[]` so they satisfy the
 * `ChatGenerationParams.messages` field.
 */
export function convertMessagesToOpenRouterParams(
  messages: BaseMessage[]
): OpenRouter.Message[] {
  return messages.map((message) => {
    const role = messageToRole(message);
    const content = contentToOpenRouterParts(message.content);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const param: Record<string, any> = { role, content };

    if (AIMessage.isInstance(message) && message.tool_calls?.length) {
      param.tool_calls = message.tool_calls.map(
        convertLangChainToolCallToOpenAI
      );
    }

    if (ToolMessage.isInstance(message) && message.tool_call_id) {
      param.tool_call_id = message.tool_call_id;
    }

    if (message.name) {
      param.name = message.name;
    }

    return param as OpenRouter.Message;
  });
}

// ---------------------------------------------------------------------------
// OpenRouter → LangChain (non-streaming)
// ---------------------------------------------------------------------------

/**
 * Convert a non-streaming OpenRouter choice into an `AIMessage`.
 */
export function convertOpenRouterResponseToAIMessage(
  choice: OpenRouter.ChatResponseChoice,
  rawResponse: OpenRouter.ChatResponse
): AIMessage {
  const msg = choice.message;
  const content = msg?.content ?? "";
  const rawToolCalls = msg?.tool_calls as
    | OpenRouter.ChatMessageToolCall[]
    | undefined;

  const toolCalls = [];
  const invalidToolCalls = [];
  for (const raw of rawToolCalls ?? []) {
    try {
      toolCalls.push(parseToolCall(raw, { returnId: true }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      invalidToolCalls.push(makeInvalidToolCall(raw, e.message));
    }
  }

  return new AIMessage({
    content,
    tool_calls: toolCalls,
    invalid_tool_calls: invalidToolCalls,
    additional_kwargs: {
      ...(rawToolCalls ? { tool_calls: rawToolCalls } : {}),
    },
    response_metadata: {
      model_provider: "openrouter",
      model_name: rawResponse.model,
      finish_reason: choice.finish_reason,
      ...(rawResponse.system_fingerprint
        ? { system_fingerprint: rawResponse.system_fingerprint }
        : {}),
    },
    id: rawResponse.id,
  });
}

// ---------------------------------------------------------------------------
// OpenRouter → LangChain (streaming)
// ---------------------------------------------------------------------------

/**
 * Convert a streaming delta into an `AIMessageChunk`.
 */
export function convertOpenRouterDeltaToAIMessageChunk(
  delta: OpenRouter.ChatStreamingMessageChunk,
  rawChunk: StreamingChunkData,
  defaultRole?: string
): AIMessageChunk {
  const role = delta.role ?? defaultRole ?? "assistant";
  const content = delta.content ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const additional_kwargs: Record<string, any> = {};
  if (delta.tool_calls) {
    additional_kwargs.tool_calls = delta.tool_calls;
  }

  const toolCallChunks: ToolCallChunk[] = [];
  if (Array.isArray(delta.tool_calls)) {
    for (const rawToolCall of delta.tool_calls) {
      toolCallChunks.push({
        name: rawToolCall.function?.name,
        args: rawToolCall.function?.arguments,
        id: rawToolCall.id,
        index: rawToolCall.index,
        type: "tool_call_chunk",
      });
    }
  }

  if (role !== "assistant") {
    return new AIMessageChunk({
      content,
      additional_kwargs,
      id: rawChunk.id,
      response_metadata: { model_provider: "openrouter" },
    });
  }

  return new AIMessageChunk({
    content,
    tool_call_chunks: toolCallChunks,
    additional_kwargs,
    id: rawChunk.id,
    response_metadata: { model_provider: "openrouter" },
  });
}

// ---------------------------------------------------------------------------
// Usage metadata
// ---------------------------------------------------------------------------

/**
 * Convert OpenRouter usage info to LangChain's `UsageMetadata`,
 * including prompt/completion token detail breakdowns when available.
 */
export function convertUsageMetadata(
  usage?: OpenRouter.ChatGenerationTokenUsage
): UsageMetadata | undefined {
  if (!usage) return undefined;

  const result: UsageMetadata = {
    input_tokens: usage.prompt_tokens,
    output_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
  };

  const promptDetails = usage.prompt_tokens_details;
  if (promptDetails) {
    const input_token_details: Record<string, number> = {};
    if (promptDetails.cached_tokens != null)
      input_token_details.cache_read = promptDetails.cached_tokens;
    if (promptDetails.audio_tokens != null)
      input_token_details.audio = promptDetails.audio_tokens;
    if (Object.keys(input_token_details).length > 0)
      result.input_token_details = input_token_details;
  }

  const completionDetails = usage.completion_tokens_details;
  if (completionDetails) {
    const output_token_details: Record<string, number> = {};
    if (completionDetails.reasoning_tokens != null)
      output_token_details.reasoning = completionDetails.reasoning_tokens;
    if (Object.keys(output_token_details).length > 0)
      result.output_token_details = output_token_details;
  }

  return result;
}
