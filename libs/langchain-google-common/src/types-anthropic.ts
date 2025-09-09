export interface AnthropicCacheControl {
  type: "ephemeral" | string;
}

interface AnthropicMessageContentBase {
  type: string;
  cache_control?: AnthropicCacheControl | null;
}

export interface AnthropicMessageContentText
  extends AnthropicMessageContentBase {
  type: "text";
  text: string;
}

export interface AnthropicMessageContentImage
  extends AnthropicMessageContentBase {
  type: "image";
  source:
    | {
        type: "base64" | string;
        media_type?: string;
        data: string;
      }
    | {
        type: "url" | string;
        url: string;
      };
}

export interface AnthropicMessageContentThinking
  extends AnthropicMessageContentBase {
  type: "thinking";
  thinking: string;
  signature: string;
}

export interface AnthropicMessageContentDocument
  extends AnthropicMessageContentBase {
  type: "document";
  source:
    | {
        type: "base64" | "text" | string;
        media_type?: "application/pdf" | "text/plain" | string;
        data: string;
      }
    | {
        type: "url" | string;
        url: string;
      }
    | {
        type: "content" | string;
        content: {
          type: "image" | string;
          source:
            | {
                type: "base64" | string;
                data: string;
                media_type?:
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp"
                  | string;
              }
            | {
                type: "url" | string;
                url: string;
              }
            | {
                type: "text" | string;
                text: string;
              };
        }[];
      };
  citations?: {
    enabled?: boolean;
  };
  context?: string;
  title?: string;
}
export interface AnthropicMessageContentRedactedThinking
  extends AnthropicMessageContentBase {
  type: "redacted_thinking";
  data: string;
}

// TODO: Define this
export type AnthropicMessageContentToolUseInput = object;

export interface AnthropicMessageContentToolUse
  extends AnthropicMessageContentBase {
  type: "tool_use";
  id: string;
  name: string;
  input: AnthropicMessageContentToolUseInput;
}

export type AnthropicMessageContentToolResultContent =
  | AnthropicMessageContentText
  | AnthropicMessageContentImage;

export interface AnthropicMessageContentToolResult
  extends AnthropicMessageContentBase {
  type: "tool_result";
  tool_use_id: string;
  is_error?: boolean;
  content: string | AnthropicMessageContentToolResultContent[];
}

export type AnthropicMessageContent =
  | AnthropicMessageContentText
  | AnthropicMessageContentImage
  | AnthropicMessageContentToolUse
  | AnthropicMessageContentToolResult
  | AnthropicMessageContentThinking
  | AnthropicMessageContentRedactedThinking;

export interface AnthropicMessage {
  role: string;
  content: string | AnthropicMessageContent[];
}

export interface AnthropicMetadata {
  user_id?: string | null;
}

interface AnthropicToolChoiceBase {
  type: string;
}

export interface AnthropicToolChoiceAuto extends AnthropicToolChoiceBase {
  type: "auto";
}

export interface AnthropicToolChoiceAny extends AnthropicToolChoiceBase {
  type: "any";
}

export interface AnthropicToolChoiceTool extends AnthropicToolChoiceBase {
  type: "tool";
  name: string;
}

export type AnthropicToolChoice =
  | AnthropicToolChoiceAuto
  | AnthropicToolChoiceAny
  | AnthropicToolChoiceTool;

// TODO: Define this
export type AnthropicToolInputSchema = object;

export interface AnthropicTool {
  type?: string; // Just available on tools 20241022 and later?
  name: string;
  description?: string;
  cache_control?: AnthropicCacheControl;
  input_schema: AnthropicToolInputSchema;
}

export interface AnthropicThinkingEnabled {
  type: "enabled";

  budget_tokens: number;
}

export interface AnthropicThinkingDisabled {
  type: "disabled";
}

export type AnthropicThinking =
  | AnthropicThinkingEnabled
  | AnthropicThinkingDisabled;

export interface AnthropicRequest {
  anthropic_version: string;
  messages: AnthropicMessage[];
  system?: string;
  stream?: boolean;
  max_tokens: number;
  temperature?: number;
  top_k?: number;
  top_p?: number;
  stop_sequences?: string[];
  metadata?: AnthropicMetadata;
  tool_choice?: AnthropicToolChoice;
  tools?: AnthropicTool[];
  thinking?: AnthropicThinking;
}

export type AnthropicRequestSettings = Pick<
  AnthropicRequest,
  "max_tokens" | "temperature" | "top_k" | "top_p" | "stop_sequences" | "stream"
>;

export interface AnthropicContentText {
  type: "text";
  text: string;
}

export interface AnthropicContentToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: object;
}

export interface AnthropicContentThinking {
  type: "thinking";
  thinking: string;
  signature: string;
}

export interface AnthropicContentRedactedThinking {
  type: "redacted_thinking";
  data: string;
}

export type AnthropicContent =
  | AnthropicContentText
  | AnthropicContentToolUse
  | AnthropicContentThinking
  | AnthropicContentRedactedThinking;

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number | null;
  cache_creation_output_tokens: number | null;
  cache_read_input_tokens: number | null;
}

export type AnthropicResponseData =
  | AnthropicResponseMessage
  | AnthropicStreamBaseEvent;

export interface AnthropicResponseMessage {
  id: string;
  type: string;
  role: string;
  content: AnthropicContent[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: AnthropicUsage;
}

export interface AnthropicAPIConfig {
  version?: string;
  thinking?: AnthropicThinking;
}

export type AnthropicStreamEventType =
  | "message_start"
  | "content_block_start"
  | "content_block_delta"
  | "content_block_stop"
  | "message_delta"
  | "message_stop"
  | "ping"
  | "error";

export type AnthropicStreamDeltaType = "text_delta" | "input_json_delta";

export interface AnthropicStreamBaseEvent {
  type: AnthropicStreamEventType;
}

export interface AnthropicStreamMessageStartEvent
  extends AnthropicStreamBaseEvent {
  type: "message_start";
  message: AnthropicResponseMessage;
}

export interface AnthropicStreamContentBlockStartEvent
  extends AnthropicStreamBaseEvent {
  type: "content_block_start";
  index: number;
  content_block: AnthropicContent;
}

export interface AnthropicStreamBaseDelta {
  type: AnthropicStreamDeltaType;
}

export interface AnthropicStreamTextDelta extends AnthropicStreamBaseDelta {
  type: "text_delta";
  text: string;
}

export interface AnthropicStreamInputJsonDelta
  extends AnthropicStreamBaseDelta {
  type: "input_json_delta";
  partial_json: string;
}

export type AnthropicStreamDelta =
  | AnthropicStreamTextDelta
  | AnthropicStreamInputJsonDelta;

export interface AnthropicStreamContentBlockDeltaEvent
  extends AnthropicStreamBaseEvent {
  type: "content_block_delta";
  index: number;
  delta: AnthropicStreamDelta;
}

export interface AnthropicStreamContentBlockStopEvent
  extends AnthropicStreamBaseEvent {
  type: "content_block_stop";
  index: number;
}

export interface AnthropicStreamMessageDeltaEvent
  extends AnthropicStreamBaseEvent {
  type: "message_delta";
  delta: Partial<AnthropicResponseMessage>;
}

export interface AnthropicStreamMessageStopEvent
  extends AnthropicStreamBaseEvent {
  type: "message_stop";
}

export interface AnthropicStreamPingEvent extends AnthropicStreamBaseEvent {
  type: "ping";
}

export interface AnthropicStreamErrorEvent extends AnthropicStreamBaseEvent {
  type: "error";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any;
}
