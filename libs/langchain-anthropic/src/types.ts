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
