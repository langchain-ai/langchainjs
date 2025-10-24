import Anthropic from "@anthropic-ai/sdk";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";

export type AnthropicToolResponse = {
  type: "tool_use";
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>;
};
export type AnthropicMessageParam = Anthropic.MessageParam;
export type AnthropicMessageResponse =
  | Anthropic.ContentBlock
  | AnthropicToolResponse;
export type AnthropicMessageCreateParams =
  Anthropic.MessageCreateParamsNonStreaming;
export type AnthropicStreamingMessageCreateParams =
  Anthropic.MessageCreateParamsStreaming;
export type AnthropicThinkingConfigParam = Anthropic.ThinkingConfigParam;
export type AnthropicContextManagementConfigParam =
  Anthropic.Beta.BetaContextManagementConfig;
export type AnthropicMessageStreamEvent = Anthropic.MessageStreamEvent;
export type AnthropicRequestOptions = Anthropic.RequestOptions;
export type AnthropicToolChoice =
  | {
      type: "tool";
      name: string;
    }
  | "any"
  | "auto"
  | "none"
  | string;
export type ChatAnthropicToolType = Anthropic.Messages.Tool | BindToolsInput;

export type AnthropicTextBlockParam = Anthropic.Messages.TextBlockParam;
export type AnthropicImageBlockParam = Anthropic.Messages.ImageBlockParam;
export type AnthropicToolUseBlockParam = Anthropic.Messages.ToolUseBlockParam;
export type AnthropicToolResultBlockParam =
  Anthropic.Messages.ToolResultBlockParam;
export type AnthropicDocumentBlockParam = Anthropic.Messages.DocumentBlockParam;
export type AnthropicThinkingBlockParam = Anthropic.Messages.ThinkingBlockParam;
export type AnthropicRedactedThinkingBlockParam =
  Anthropic.Messages.RedactedThinkingBlockParam;
export type AnthropicServerToolUseBlockParam =
  Anthropic.Messages.ServerToolUseBlockParam;
export type AnthropicWebSearchToolResultBlockParam =
  Anthropic.Messages.WebSearchToolResultBlockParam;
export type AnthropicWebSearchResultBlockParam =
  Anthropic.Messages.WebSearchResultBlockParam;
export type AnthropicSearchResultBlockParam = Anthropic.SearchResultBlockParam;

// Union of all possible content block types including server tool use
export type ChatAnthropicContentBlock =
  | AnthropicTextBlockParam
  | AnthropicImageBlockParam
  | AnthropicToolUseBlockParam
  | AnthropicToolResultBlockParam
  | AnthropicDocumentBlockParam
  | AnthropicThinkingBlockParam
  | AnthropicRedactedThinkingBlockParam
  | AnthropicServerToolUseBlockParam
  | AnthropicWebSearchToolResultBlockParam
  | AnthropicWebSearchResultBlockParam
  | AnthropicSearchResultBlockParam;

export function isAnthropicImageBlockParam(
  block: unknown
): block is AnthropicImageBlockParam {
  if (block == null) {
    return false;
  }
  if (typeof block !== "object") {
    return false;
  }
  if (!("type" in block) || block.type !== "image") {
    return false;
  }

  if (!("source" in block) || typeof block.source !== "object") {
    return false;
  }

  if (block.source == null) {
    return false;
  }

  if (!("type" in block.source)) {
    return false;
  }

  if (block.source.type === "base64") {
    if (!("media_type" in block.source)) {
      return false;
    }

    if (typeof block.source.media_type !== "string") {
      return false;
    }

    if (!("data" in block.source)) {
      return false;
    }

    if (typeof block.source.data !== "string") {
      return false;
    }

    return true;
  }

  if (block.source.type === "url") {
    if (!("url" in block.source)) {
      return false;
    }

    if (typeof block.source.url !== "string") {
      return false;
    }

    return true;
  }

  return false;
}

// Type for built-in tools only (excludes custom Tool type)
export type AnthropicBuiltInToolUnion = Exclude<
  Anthropic.Messages.ToolUnion,
  Anthropic.Messages.Tool
>;
