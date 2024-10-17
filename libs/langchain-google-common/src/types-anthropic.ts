
export interface AnthropicCacheControl {
  type: "ephemeral" | string,
}

interface AnthropicMessageContentBase {
  type: string,
  cache_control?: AnthropicCacheControl | null,
}

export interface AnthropicMessageContentText extends AnthropicMessageContentBase {
  type: "text",
  text: string,
}

export interface AnthropicMessageContentImage extends AnthropicMessageContentBase {
  type: "image",
  source: {
    type: "base64" | string,
    media_type: string,
    data: string,
  }
}

// TODO: Define this
export type AnthropicMessageContentToolUseInput = object;

export interface AnthropicMessageContentToolUse extends AnthropicMessageContentBase {
  type: "tool_use",
  id: string,
  name: string,
  input: AnthropicMessageContentToolUseInput,
}

export type AnthropicMessageContentToolResultContent =
  | AnthropicMessageContentText
  | AnthropicMessageContentImage;

export interface AnthropicMessageContentToolResult extends AnthropicMessageContentBase {
  type: "tool_result",
  tool_use_id: string,
  is_error?: boolean,
  content: string | AnthropicMessageContentToolResultContent,
}

export type AnthropicMessageContent =
  | AnthropicMessageContentText
  | AnthropicMessageContentImage
  | AnthropicMessageContentToolUse
  | AnthropicMessageContentToolResult;

export interface AnthropicMessage {
  role: string,
  content: string | AnthropicMessageContent[],
}

export interface AnthropicMetadata {
  user_id?: string | null,
}

interface AnthropicToolChoiceBase {
  type: string,
}

export interface AnthropicToolChoiceAuto extends AnthropicToolChoiceBase {
  type: "auto",
}

export interface AnthropicToolChoiceAny extends AnthropicToolChoiceBase {
  type: "any",
}

export interface AnthropicToolChoiceTool extends AnthropicToolChoiceBase {
  type: "tool",
  name: string,
}

export type AnthropicToolChoice =
  | AnthropicToolChoiceAuto
  | AnthropicToolChoiceAny
  | AnthropicToolChoiceTool;

// TODO: Define this
export type AnthropicToolInputSchema = object;

export interface AnthropicTool {
  name: string,
  description?: string,
  cache_control?: AnthropicCacheControl,
  input_schema: AnthropicToolInputSchema
}

export interface AnthropicRequest {
  anthropic_version: string,
  messages: AnthropicMessage[],
  system?: string,
  max_tokens: number,
  temperature?: number,
  top_k?: number,
  top_p?: number,
  stop_sequences?: string[],
  metadata?: AnthropicMetadata,
  tool_choice?: AnthropicToolChoice,
  tools?: AnthropicTool[],
}

export type AnthropicRequestSettings = Pick<AnthropicRequest,
  | "max_tokens"
  | "temperature"
  | "top_k"
  | "top_p"
  | "stop_sequences"
>

export interface AnthropicContentText {
  type: "text",
  text: string,
}

export interface AnthropicContentToolUse {
  type: "tool_use",
  id: string,
  name: string,
  input: object,
}

export type AnthropicContent =
  | AnthropicContentText
  | AnthropicContentToolUse;

export interface AnthropicUsage {
  input_tokens: number,
  output_tokens: number,
  cache_creation_input_tokens: number | null,
  cache_creation_output_tokens: number | null,
}

export interface AnthropicResponseData {
  id: string,
  type: string,
  role: string,
  content: AnthropicContent[],
  model: string,
  stop_reason: string | null,
  stop_sequence: string | null,
  usage: AnthropicUsage,
}

export interface AnthropicAPIConfig {
  version?: string;
}