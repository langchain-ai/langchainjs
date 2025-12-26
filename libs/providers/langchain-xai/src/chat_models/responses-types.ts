// ============================================================================
// Input Content Item Types
// ============================================================================

/**
 * Text input content item.
 */
export interface XAIResponsesInputTextItem {
  type: "input_text";
  /** The text content. */
  text: string;
}

/**
 * Image input content item.
 * Note: Storing/fetching images is not fully supported.
 */
export interface XAIResponsesInputImageItem {
  type: "input_image";
  /** Public URL of the image. */
  image_url: string;
  /** Image detail level. */
  detail?: "high" | "low" | "auto";
}

/**
 * File input content item.
 */
export interface XAIResponsesInputFileItem {
  type: "input_file";
  /** File ID from the Files API. */
  file_id: string;
}

/**
 * Union type for all input content items.
 */
export type XAIResponsesInputContentItem =
  | XAIResponsesInputTextItem
  | XAIResponsesInputImageItem
  | XAIResponsesInputFileItem;

// ============================================================================
// Previous Response Tool Call Types (for input)
// ============================================================================

/**
 * Function tool call from a previous response.
 */
export interface XAIResponsesFunctionToolCall {
  type: "function_call";
  /** The ID of the tool call. */
  id: string;
  /** The ID of the tool call (alias). */
  call_id?: string;
  /** The name of the function. */
  name: string;
  /** The arguments to the function as a JSON string. */
  arguments: string;
}

/**
 * Web search tool call from a previous response.
 */
export interface XAIResponsesWebSearchToolCall {
  type: "web_search_call";
  /** The ID of the tool call. */
  id: string;
  /** The search status. */
  status?: "in_progress" | "searching" | "completed" | "failed";
}

/**
 * Code interpreter tool call from a previous response.
 */
export interface XAIResponsesCodeInterpreterToolCall {
  type: "code_interpreter_call";
  /** The ID of the tool call. */
  id: string;
  /** The code to execute. */
  code?: string;
  /** The status of the code interpreter. */
  status?: "in_progress" | "interpreting" | "completed" | "failed";
}

/**
 * MCP tool call from a previous response.
 */
export interface XAIResponsesMcpToolCall {
  type: "mcp_call";
  /** The ID of the tool call. */
  id: string;
  /** The MCP server URL. */
  server_url?: string;
  /** The MCP server label. */
  server_label?: string;
}

/**
 * Union type for all tool calls from previous responses.
 */
export type XAIResponsesToolCall =
  | XAIResponsesFunctionToolCall
  | XAIResponsesWebSearchToolCall
  | XAIResponsesCodeInterpreterToolCall
  | XAIResponsesMcpToolCall;

/**
 * Log probability information for a token.
 */
export interface XAIResponsesLogprobToken {
  /** The token string. */
  token: string;
  /** The log probability of the token. */
  logprob: number;
  /** The bytes representation of the token. */
  bytes?: number[];
}

/**
 * Log probability content item.
 */
export interface XAIResponsesLogprobContent {
  /** The token. */
  token: string;
  /** The log probability. */
  logprob: number;
  /** The bytes representation. */
  bytes?: number[];
  /** Top log probabilities at this position. */
  top_logprobs?: XAIResponsesLogprobToken[];
}

/**
 * Log probabilities from a previous response.
 */
export interface XAIResponsesLogprobs {
  /** Log probability content. */
  content?: XAIResponsesLogprobContent[];
}

/**
 * Previous response structure that can be included in the input array.
 * Used for multi-turn conversations with assistant outputs.
 */
export interface XAIResponsesPreviousResponse {
  /** The type identifier for previous response. */
  type: "message";
  /** The role for previous assistant responses. */
  role: "assistant";
  /** The text output from the previous response. */
  text?: string;
  /** Refusal message if the model refused to respond. */
  refusal?: string;
  /** Tool calls made in the previous response. */
  tool_calls?: XAIResponsesToolCall[];
  /** Log probabilities from the previous response. */
  logprobs?: XAIResponsesLogprobs;
}

/**
 * Function tool call output to provide results back to the model.
 */
export interface XAIResponsesFunctionToolOutput {
  type: "function_call_output";
  /** The ID of the tool call this output is for. */
  call_id: string;
  /** The output/result of the function call. */
  output: string;
}

/**
 * Union type for tool outputs that can be included in input.
 */
export type XAIResponsesToolOutput = XAIResponsesFunctionToolOutput;

// ============================================================================
// Message Types
// ============================================================================

/**
 * Message role types.
 */
export type XAIResponsesMessageRole =
  | "user"
  | "assistant"
  | "system"
  | "developer";

/**
 * Message input to the model.
 */
export interface XAIResponsesMessage {
  /** The role of the message author. */
  role: XAIResponsesMessageRole;
  /** Text, image, or audio input. Can be a string or array of content items. */
  content: string | XAIResponsesInputContentItem[];
  /** Unique identifier for the end-user. Only for `user` messages. */
  name?: string;
}

/**
 * Union type for all items that can appear in the input array.
 * Includes messages, previous responses, and tool outputs.
 */
export type XAIResponsesInputItem =
  | XAIResponsesMessage
  | XAIResponsesPreviousResponse
  | XAIResponsesToolOutput;

/**
 * Input type - can be a string or array of input items.
 * The array can contain messages, previous responses, and tool outputs.
 */
export type XAIResponsesInput = string | XAIResponsesInputItem[];

// ============================================================================
// Reasoning Configuration
// ============================================================================

/**
 * Reasoning effort level.
 */
export type XAIResponsesReasoningEffort = "low" | "medium" | "high";

/**
 * Reasoning summary style.
 */
export type XAIResponsesReasoningSummary = "auto" | "concise" | "detailed";

/**
 * Reasoning configuration for reasoning models.
 */
export interface XAIResponsesReasoning {
  /** The effort level for reasoning. Defaults to `medium`. */
  effort?: XAIResponsesReasoningEffort;
  /** The summary style for reasoning output. */
  summary?: XAIResponsesReasoningSummary;
}

// ============================================================================
// Search Parameters
// ============================================================================

/**
 * X (Twitter) search source configuration.
 */
export interface XAIResponsesSearchSourceX {
  type: "x";
  /** X handles to include in search. */
  included_x_handles?: string[];
  /** X handles to exclude from search. */
  excluded_x_handles?: string[];
  /** Minimum favorite count for posts. */
  post_favorite_count?: number;
  /** Minimum view count for posts. */
  post_view_count?: number;
}

/**
 * Web search source configuration.
 */
export interface XAIResponsesSearchSourceWeb {
  type: "web";
  /** Whitelist of allowed websites (max 5). */
  allowed_websites?: string[];
  /** Blacklist of excluded websites (max 5). */
  excluded_websites?: string[];
  /** ISO alpha-2 country code. */
  country?: string;
  /** Whether to enable safe search. Defaults to `true`. */
  safe_search?: boolean;
}

/**
 * RSS/News search source configuration.
 */
export interface XAIResponsesSearchSourceRss {
  type: "rss";
  /** Links of RSS feeds. */
  links?: string[];
}

/**
 * Union type for all search sources.
 */
export type XAIResponsesSearchSource =
  | XAIResponsesSearchSourceX
  | XAIResponsesSearchSourceWeb
  | XAIResponsesSearchSourceRss;

/**
 * Search mode options.
 */
export type XAIResponsesSearchMode = "off" | "on" | "auto";

/**
 * Search parameters configuration.
 * Takes precedence over `web_search_preview` tool.
 */
export interface XAIResponsesSearchParameters {
  /** Start date for search results (ISO-8601 YYYY-MM-DD). */
  from_date?: string;
  /** End date for search results (ISO-8601 YYYY-MM-DD). */
  to_date?: string;
  /** Maximum number of search results. Defaults to 15 (range: 1-30). */
  max_search_results?: number;
  /** Search mode. Defaults to `on`. */
  mode?: XAIResponsesSearchMode;
  /** Whether to return citations. Defaults to `true`. */
  return_citations?: boolean;
  /** List of search sources. If empty, searches web and X. */
  sources?: XAIResponsesSearchSource[];
}

// ============================================================================
// Text Response Format
// ============================================================================

/**
 * Plain text format.
 */
export interface XAIResponsesTextFormatText {
  type: "text";
}

/**
 * JSON object format.
 */
export interface XAIResponsesTextFormatJsonObject {
  type: "json_object";
}

/**
 * JSON schema format.
 */
export interface XAIResponsesTextFormatJsonSchema {
  type: "json_schema";
  /** JSON schema definition. */
  schema: Record<string, unknown>;
  /** Compatibility field for strict mode. */
  strict?: boolean;
}

/**
 * Union type for all text response formats.
 */
export type XAIResponsesTextFormat =
  | XAIResponsesTextFormatText
  | XAIResponsesTextFormatJsonObject
  | XAIResponsesTextFormatJsonSchema;

/**
 * Text response configuration.
 */
export interface XAIResponsesText {
  /** The format for text response. */
  format?: XAIResponsesTextFormat;
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Function tool parameters using JSON Schema.
 */
export interface XAIResponsesFunctionToolFunction {
  /** The name of the function. */
  name: string;
  /** A description of what the function does. */
  description?: string;
  /** The parameters the function accepts, described as a JSON Schema object. */
  parameters: Record<string, unknown>;
}

/**
 * Function tool definition.
 */
export interface XAIResponsesFunctionTool {
  type: "function";
  /** The function definition. */
  function: XAIResponsesFunctionToolFunction;
}

/**
 * Web search tool definition.
 * Compatibility fields (search_context_size, user_location, filters) are rejected if set.
 */
export interface XAIResponsesWebSearchTool {
  type: "web_search";
  /** @deprecated Rejected if set. */
  search_context_size?: never;
  /** @deprecated Rejected if set. */
  user_location?: never;
  /** @deprecated Rejected if set. */
  filters?: never;
}

/**
 * X search tool definition.
 */
export interface XAIResponsesXSearchTool {
  type: "x_search";
  /** X handles to allow in search. */
  allowed_x_handles?: string[];
  /** X handles to exclude from search. */
  excluded_x_handles?: string[];
  /** Whether to enable image understanding. */
  enable_image_understanding?: boolean;
  /** Whether to enable video understanding. */
  enable_video_understanding?: boolean;
  /** Start date for search (ISO-8601). */
  from_date?: string;
  /** End date for search (ISO-8601). */
  to_date?: string;
}

/**
 * File search tool definition.
 */
export interface XAIResponsesFileSearchTool {
  type: "file_search";
  /** List of vector store IDs to search. */
  vector_store_ids?: string[];
}

/**
 * Code interpreter tool definition.
 */
export interface XAIResponsesCodeInterpreterTool {
  type: "code_interpreter";
}

/**
 * MCP (Model Context Protocol) tool definition.
 */
export interface XAIResponsesMcpTool {
  type: "mcp";
  /** The URL of the MCP server. */
  server_url: string;
  /** The label for the MCP server. */
  server_label: string;
}

/**
 * Union type for all tool definitions.
 */
export type XAIResponsesTool =
  | XAIResponsesFunctionTool
  | XAIResponsesWebSearchTool
  | XAIResponsesXSearchTool
  | XAIResponsesFileSearchTool
  | XAIResponsesCodeInterpreterTool
  | XAIResponsesMcpTool;

// ============================================================================
// Tool Choice
// ============================================================================

/**
 * String tool choice options.
 */
export type XAIResponsesToolChoiceString = "none" | "auto" | "required";

/**
 * Function tool choice object.
 */
export interface XAIResponsesToolChoiceFunction {
  type: "function";
  function: {
    /** The name of the function to call. */
    name: string;
  };
}

/**
 * Tool choice configuration.
 */
export type XAIResponsesToolChoice =
  | XAIResponsesToolChoiceString
  | XAIResponsesToolChoiceFunction;

// ============================================================================
// Include Options
// ============================================================================

/**
 * Additional output data to include in the response.
 */
export type XAIResponsesInclude = "reasoning.encrypted_content";

// ============================================================================
// Main Request Body
// ============================================================================

/**
 * xAI Responses API request body parameters.
 */
export interface XAIResponsesCreateParams {
  /**
   * The input passed to the model.
   * Can be text (string) or an array of message objects.
   */
  input: XAIResponsesInput;

  /**
   * Model name for the model to use (e.g., from xAI console).
   */
  model?: string;

  /**
   * Whether to process the response asynchronously in the background.
   * Note: Unsupported.
   * @default false
   */
  background?: boolean;

  /**
   * What additional output data to include in the response.
   * Currently supported: `reasoning.encrypted_content`.
   */
  include?: XAIResponsesInclude[];

  /**
   * An alternate way to specify the system prompt.
   * Cannot be used with `previous_response_id`.
   */
  instructions?: string;

  /**
   * Whether to return log probabilities of the output tokens.
   * @default false
   */
  logprobs?: boolean;

  /**
   * Max number of tokens that can be generated.
   * Includes both output and reasoning tokens.
   */
  max_output_tokens?: number;

  /**
   * Metadata for the request.
   * Note: Not supported. Maintained for compatibility.
   */
  metadata?: Record<string, unknown>;

  /**
   * Whether to allow the model to run parallel tool calls.
   * @default true
   */
  parallel_tool_calls?: boolean;

  /**
   * The ID of the previous response from the model.
   * Use this to create multi-turn conversations.
   */
  previous_response_id?: string;

  /**
   * Reasoning configuration.
   * Only for reasoning models.
   */
  reasoning?: XAIResponsesReasoning;

  /**
   * Set parameters for searched data.
   * Takes precedence over `web_search_preview` tool.
   */
  search_parameters?: XAIResponsesSearchParameters;

  /**
   * Service tier for the request.
   * Note: Not supported. Maintained for compatibility.
   */
  service_tier?: string;

  /**
   * Whether to store the input message(s) and response.
   * @default true
   */
  store?: boolean;

  /**
   * If set, partial message deltas will be sent as server-sent events.
   * @default false
   */
  stream?: boolean;

  /**
   * Sampling temperature between 0 and 2.
   * Higher values make output more random, lower values more deterministic.
   * @default 1
   */
  temperature?: number;

  /**
   * Settings for customizing a text response.
   */
  text?: XAIResponsesText;

  /**
   * Controls which tool is called by the model.
   */
  tool_choice?: XAIResponsesToolChoice;

  /**
   * A list of tools the model may call.
   * Maximum of 128 tools.
   */
  tools?: XAIResponsesTool[];

  /**
   * Number of most likely tokens to return at each token position.
   * Range: 0-8. Requires `logprobs` to be `true`.
   */
  top_logprobs?: number;

  /**
   * Nucleus sampling probability mass.
   * The model considers results of tokens with top_p probability mass.
   * @default 1
   */
  top_p?: number;

  /**
   * Truncation strategy.
   * Note: Not supported. Maintained for compatibility.
   */
  truncation?: string;

  /**
   * Unique identifier representing your end-user.
   * Used for monitoring and abuse detection.
   */
  user?: string;
}

/**
 * Streaming variant of the request params.
 */
export interface XAIResponsesCreateParamsStreaming
  extends XAIResponsesCreateParams {
  stream: true;
}

/**
 * Non-streaming variant of the request params.
 */
export interface XAIResponsesCreateParamsNonStreaming
  extends XAIResponsesCreateParams {
  stream?: false;
}

// ============================================================================
// Response Body Types
// ============================================================================

/**
 * Response status values.
 */
export type XAIResponsesStatus = "completed" | "in_progress" | "incomplete";

/**
 * Response object type literal.
 */
export type XAIResponsesObjectType = "response";

// ============================================================================
// Response Output Item Types
// ============================================================================

/**
 * Text output item in the response.
 */
export interface XAIResponsesOutputTextItem {
  type: "message";
  /** The role of the message (always assistant for outputs). */
  role: "assistant";
  /** The text content of the message. */
  content: XAIResponsesOutputContent[];
  /** The ID of this output item. */
  id?: string;
  /** The status of this output item. */
  status?: XAIResponsesStatus;
}

/**
 * Text content in an output message.
 */
export interface XAIResponsesOutputTextContent {
  type: "output_text";
  /** The text content. */
  text: string;
  /** Annotations on the text (e.g., citations). */
  annotations?: XAIResponsesAnnotation[];
}

/**
 * Refusal content in an output message.
 */
export interface XAIResponsesOutputRefusalContent {
  type: "refusal";
  /** The refusal message. */
  refusal: string;
}

/**
 * Union type for output content items.
 */
export type XAIResponsesOutputContent =
  | XAIResponsesOutputTextContent
  | XAIResponsesOutputRefusalContent;

/**
 * Citation annotation for web search results.
 */
export interface XAIResponsesUrlCitationAnnotation {
  type: "url_citation";
  /** Start index in the text. */
  start_index: number;
  /** End index in the text. */
  end_index: number;
  /** The URL being cited. */
  url: string;
  /** The title of the cited page. */
  title?: string;
}

/**
 * File citation annotation.
 */
export interface XAIResponsesFileCitationAnnotation {
  type: "file_citation";
  /** Start index in the text. */
  start_index: number;
  /** End index in the text. */
  end_index: number;
  /** The file ID being cited. */
  file_id: string;
  /** The filename. */
  filename?: string;
}

/**
 * Union type for all annotation types.
 */
export type XAIResponsesAnnotation =
  | XAIResponsesUrlCitationAnnotation
  | XAIResponsesFileCitationAnnotation;

/**
 * Function call output item.
 */
export interface XAIResponsesOutputFunctionCall {
  type: "function_call";
  /** The ID of the function call. */
  id: string;
  /** The ID of the function call (alias). */
  call_id?: string;
  /** The name of the function being called. */
  name: string;
  /** The arguments to the function as a JSON string. */
  arguments: string;
  /** The status of the function call. */
  status?: XAIResponsesStatus;
}

/**
 * Web search call output item.
 */
export interface XAIResponsesOutputWebSearchCall {
  type: "web_search_call";
  /** The ID of the web search call. */
  id: string;
  /** The status of the web search. */
  status?: "in_progress" | "searching" | "completed" | "failed";
}

/**
 * File search call output item.
 */
export interface XAIResponsesOutputFileSearchCall {
  type: "file_search_call";
  /** The ID of the file search call. */
  id: string;
  /** The status of the file search. */
  status?: "in_progress" | "searching" | "completed" | "failed";
  /** The search queries used. */
  queries?: string[];
  /** The search results. */
  results?: XAIResponsesFileSearchResult[];
}

/**
 * File search result item.
 */
export interface XAIResponsesFileSearchResult {
  /** The file ID. */
  file_id: string;
  /** The filename. */
  filename?: string;
  /** The score/relevance of the result. */
  score?: number;
  /** The matched text content. */
  text?: string;
}

/**
 * Code interpreter call output item.
 */
export interface XAIResponsesOutputCodeInterpreterCall {
  type: "code_interpreter_call";
  /** The ID of the code interpreter call. */
  id: string;
  /** The code being executed. */
  code?: string;
  /** The status of the code interpreter. */
  status?: "in_progress" | "interpreting" | "completed" | "failed";
  /** The results of the code execution. */
  results?: XAIResponsesCodeInterpreterResult[];
}

/**
 * Code interpreter result item.
 */
export interface XAIResponsesCodeInterpreterResult {
  type: "logs" | "image";
  /** The log output (for type "logs"). */
  logs?: string;
  /** The image data (for type "image"). */
  image?: {
    /** The base64-encoded image data. */
    data?: string;
    /** The MIME type of the image. */
    media_type?: string;
  };
}

/**
 * MCP call output item.
 */
export interface XAIResponsesOutputMcpCall {
  type: "mcp_call";
  /** The ID of the MCP call. */
  id: string;
  /** The MCP server URL. */
  server_url?: string;
  /** The MCP server label. */
  server_label?: string;
  /** The status of the MCP call. */
  status?: "in_progress" | "completed" | "failed";
}

/**
 * Reasoning output item.
 */
export interface XAIResponsesOutputReasoning {
  type: "reasoning";
  /** The ID of the reasoning item. */
  id?: string;
  /** Summary of the reasoning. */
  summary?: XAIResponsesReasoningSummaryItem[];
  /** Encrypted reasoning content (if included). */
  encrypted_content?: string;
}

/**
 * Reasoning summary item.
 */
export interface XAIResponsesReasoningSummaryItem {
  type: "summary_text";
  /** The summary text. */
  text: string;
}

/**
 * Union type for all response output items.
 */
export type XAIResponsesOutputItem =
  | XAIResponsesOutputTextItem
  | XAIResponsesOutputFunctionCall
  | XAIResponsesOutputWebSearchCall
  | XAIResponsesOutputFileSearchCall
  | XAIResponsesOutputCodeInterpreterCall
  | XAIResponsesOutputMcpCall
  | XAIResponsesOutputReasoning;

// ============================================================================
// Response Usage
// ============================================================================

/**
 * Token usage information for the response.
 */
export interface XAIResponsesUsage {
  /** Number of tokens in the input/prompt. */
  input_tokens: number;
  /** Number of tokens in the output/completion. */
  output_tokens: number;
  /** Total number of tokens used. */
  total_tokens: number;
  /** Detailed breakdown of input tokens. */
  input_tokens_details?: {
    /** Cached tokens from previous requests. */
    cached_tokens?: number;
  };
  /** Detailed breakdown of output tokens. */
  output_tokens_details?: {
    /** Tokens used for reasoning. */
    reasoning_tokens?: number;
  };
}

// ============================================================================
// Response Incomplete Details
// ============================================================================

/**
 * Reason for incomplete response.
 */
export type XAIResponsesIncompleteReason =
  | "max_output_tokens"
  | "content_filter"
  | "turn_limit"
  | "tool_use_limit";

/**
 * Details about why a response is incomplete.
 */
export interface XAIResponsesIncompleteDetails {
  /** The reason the response is incomplete. */
  reason?: XAIResponsesIncompleteReason;
}

// ============================================================================
// Response Debug Output
// ============================================================================

/**
 * Debug output information (when available).
 */
export interface XAIResponsesDebugOutput {
  /** Debug model information. */
  model_info?: Record<string, unknown>;
  /** Additional debug data. */
  [key: string]: unknown;
}

// ============================================================================
// Response Reasoning (for response body)
// ============================================================================

/**
 * Reasoning configuration echoed in the response.
 */
export interface XAIResponsesReasoningResponse {
  /** The effort level used for reasoning. */
  effort?: XAIResponsesReasoningEffort;
  /** The summary style used. */
  summary?: XAIResponsesReasoningSummary;
}

// ============================================================================
// Main Response Body
// ============================================================================

/**
 * xAI Responses API response body.
 */
export interface XAIResponse {
  /**
   * Unique ID of the response.
   */
  id: string;

  /**
   * The object type of this resource. Always set to `response`.
   */
  object: XAIResponsesObjectType;

  /**
   * The Unix timestamp (in seconds) for the response creation time.
   */
  created_at: number;

  /**
   * Model name used to generate the response.
   */
  model: string;

  /**
   * Status of the response.
   */
  status: XAIResponsesStatus;

  /**
   * The response generated by the model.
   */
  output: XAIResponsesOutputItem[];

  /**
   * Whether to allow the model to run parallel tool calls.
   */
  parallel_tool_calls?: boolean;

  /**
   * Whether to store the input message(s) and response.
   * @default true
   */
  store?: boolean;

  /**
   * Settings for customizing a text response.
   */
  text?: XAIResponsesText;

  /**
   * Controls which tool is called by the model.
   */
  tool_choice?: XAIResponsesToolChoice;

  /**
   * A list of tools the model may call.
   * Maximum of 128 tools.
   */
  tools?: XAIResponsesTool[];

  /**
   * Whether to process the response asynchronously in the background.
   * Note: Unsupported.
   * @default false
   */
  background?: boolean | null;

  /**
   * Debug output information (when available).
   */
  debug_output?: XAIResponsesDebugOutput | null;

  /**
   * Details about why the response is incomplete (if status is "incomplete").
   */
  incomplete_details?: XAIResponsesIncompleteDetails | null;

  /**
   * Max number of tokens that can be generated.
   * Includes both output and reasoning tokens.
   */
  max_output_tokens?: number | null;

  /**
   * Only included for compatibility.
   */
  metadata?: Record<string, unknown> | null;

  /**
   * The ID of the previous response from the model.
   */
  previous_response_id?: string | null;

  /**
   * Reasoning configuration used for the response.
   */
  reasoning?: XAIResponsesReasoningResponse | null;

  /**
   * Sampling temperature used (between 0 and 2).
   * @default 1
   */
  temperature?: number | null;

  /**
   * Nucleus sampling probability mass used.
   * @default 1
   */
  top_p?: number | null;

  /**
   * Token usage information.
   */
  usage?: XAIResponsesUsage | null;

  /**
   * Unique identifier representing your end-user.
   * Used for monitoring and abuse detection.
   */
  user?: string | null;
}

// ============================================================================
// Streaming Event Types
// ============================================================================

/**
 * Base streaming event structure.
 */
export interface XAIResponsesStreamEventBase {
  /** The type of the streaming event. */
  type: string;
}

/**
 * Response created event.
 */
export interface XAIResponsesStreamEventCreated
  extends XAIResponsesStreamEventBase {
  type: "response.created";
  /** The response object. */
  response: XAIResponse;
}

/**
 * Response in progress event.
 */
export interface XAIResponsesStreamEventInProgress
  extends XAIResponsesStreamEventBase {
  type: "response.in_progress";
  /** The response object. */
  response: XAIResponse;
}

/**
 * Response completed event.
 */
export interface XAIResponsesStreamEventCompleted
  extends XAIResponsesStreamEventBase {
  type: "response.completed";
  /** The completed response object. */
  response: XAIResponse;
}

/**
 * Response failed event.
 */
export interface XAIResponsesStreamEventFailed
  extends XAIResponsesStreamEventBase {
  type: "response.failed";
  /** The failed response object. */
  response: XAIResponse;
  /** Error information. */
  error?: {
    /** Error code. */
    code?: string;
    /** Error message. */
    message?: string;
  };
}

/**
 * Response incomplete event.
 */
export interface XAIResponsesStreamEventIncomplete
  extends XAIResponsesStreamEventBase {
  type: "response.incomplete";
  /** The incomplete response object. */
  response: XAIResponse;
}

/**
 * Output item added event.
 */
export interface XAIResponsesStreamEventOutputItemAdded
  extends XAIResponsesStreamEventBase {
  type: "response.output_item.added";
  /** The index of the output item. */
  output_index: number;
  /** The output item that was added. */
  item: XAIResponsesOutputItem;
}

/**
 * Output item done event.
 */
export interface XAIResponsesStreamEventOutputItemDone
  extends XAIResponsesStreamEventBase {
  type: "response.output_item.done";
  /** The index of the output item. */
  output_index: number;
  /** The completed output item. */
  item: XAIResponsesOutputItem;
}

/**
 * Content part added event.
 */
export interface XAIResponsesStreamEventContentPartAdded
  extends XAIResponsesStreamEventBase {
  type: "response.content_part.added";
  /** The index of the output item. */
  output_index: number;
  /** The index of the content part. */
  content_index: number;
  /** The content part that was added. */
  part: XAIResponsesOutputContent;
}

/**
 * Content part done event.
 */
export interface XAIResponsesStreamEventContentPartDone
  extends XAIResponsesStreamEventBase {
  type: "response.content_part.done";
  /** The index of the output item. */
  output_index: number;
  /** The index of the content part. */
  content_index: number;
  /** The completed content part. */
  part: XAIResponsesOutputContent;
}

/**
 * Text delta event (streaming text).
 */
export interface XAIResponsesStreamEventTextDelta
  extends XAIResponsesStreamEventBase {
  type: "response.output_text.delta";
  /** The index of the output item. */
  output_index: number;
  /** The index of the content part. */
  content_index: number;
  /** The text delta. */
  delta: string;
}

/**
 * Text done event.
 */
export interface XAIResponsesStreamEventTextDone
  extends XAIResponsesStreamEventBase {
  type: "response.output_text.done";
  /** The index of the output item. */
  output_index: number;
  /** The index of the content part. */
  content_index: number;
  /** The complete text. */
  text: string;
}

/**
 * Function call arguments delta event.
 */
export interface XAIResponsesStreamEventFunctionCallArgumentsDelta
  extends XAIResponsesStreamEventBase {
  type: "response.function_call_arguments.delta";
  /** The index of the output item. */
  output_index: number;
  /** The ID of the function call. */
  call_id: string;
  /** The arguments delta. */
  delta: string;
}

/**
 * Function call arguments done event.
 */
export interface XAIResponsesStreamEventFunctionCallArgumentsDone
  extends XAIResponsesStreamEventBase {
  type: "response.function_call_arguments.done";
  /** The index of the output item. */
  output_index: number;
  /** The ID of the function call. */
  call_id: string;
  /** The complete arguments. */
  arguments: string;
}

/**
 * Reasoning summary text delta event.
 */
export interface XAIResponsesStreamEventReasoningSummaryTextDelta
  extends XAIResponsesStreamEventBase {
  type: "response.reasoning_summary_text.delta";
  /** The index of the output item. */
  output_index: number;
  /** The index of the summary part. */
  summary_index: number;
  /** The text delta. */
  delta: string;
}

/**
 * Reasoning summary text done event.
 */
export interface XAIResponsesStreamEventReasoningSummaryTextDone
  extends XAIResponsesStreamEventBase {
  type: "response.reasoning_summary_text.done";
  /** The index of the output item. */
  output_index: number;
  /** The index of the summary part. */
  summary_index: number;
  /** The complete text. */
  text: string;
}

/**
 * Error event.
 */
export interface XAIResponsesStreamEventError
  extends XAIResponsesStreamEventBase {
  type: "error";
  /** Error code. */
  code?: string;
  /** Error message. */
  message?: string;
  /** Error parameter. */
  param?: string;
}

/**
 * Union type for all streaming events.
 */
export type XAIResponsesStreamEvent =
  | XAIResponsesStreamEventCreated
  | XAIResponsesStreamEventInProgress
  | XAIResponsesStreamEventCompleted
  | XAIResponsesStreamEventFailed
  | XAIResponsesStreamEventIncomplete
  | XAIResponsesStreamEventOutputItemAdded
  | XAIResponsesStreamEventOutputItemDone
  | XAIResponsesStreamEventContentPartAdded
  | XAIResponsesStreamEventContentPartDone
  | XAIResponsesStreamEventTextDelta
  | XAIResponsesStreamEventTextDone
  | XAIResponsesStreamEventFunctionCallArgumentsDelta
  | XAIResponsesStreamEventFunctionCallArgumentsDone
  | XAIResponsesStreamEventReasoningSummaryTextDelta
  | XAIResponsesStreamEventReasoningSummaryTextDone
  | XAIResponsesStreamEventError;

// ============================================================================
// LangChain Integration Types
// ============================================================================

import type {
  BaseChatModelCallOptions,
  BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";

/**
 * Call options for ChatXAIResponses.
 */
export interface ChatXAIResponsesCallOptions extends BaseChatModelCallOptions {
  /**
   * Configuration options for a text response from the model.
   */
  text?: XAIResponsesText;

  /**
   * Specify additional output data to include in the model response.
   */
  include?: XAIResponsesInclude[];

  /**
   * The unique ID of the previous response to the model.
   * Use this to create multi-turn conversations.
   */
  previous_response_id?: string;

  /**
   * Search parameters for xAI's search capabilities.
   */
  search_parameters?: XAIResponsesSearchParameters;

  /**
   * Reasoning configuration for reasoning models.
   */
  reasoning?: XAIResponsesReasoning;

  /**
   * Controls which tool is called by the model.
   */
  tool_choice?: XAIResponsesToolChoice;

  /**
   * Whether to allow the model to run parallel tool calls.
   */
  parallel_tool_calls?: boolean;
}

/**
 * Input configuration for ChatXAIResponses constructor.
 */
export interface ChatXAIResponsesInput extends BaseChatModelParams {
  /**
   * The xAI API key to use for requests.
   * @default process.env.XAI_API_KEY
   */
  apiKey?: string;

  /**
   * The name of the model to use.
   * @default "grok-3"
   */
  model?: string;

  /**
   * Whether to stream responses.
   * @default false
   */
  streaming?: boolean;

  /**
   * Sampling temperature between 0 and 2.
   * @default 1
   */
  temperature?: number;

  /**
   * Nucleus sampling probability mass.
   * @default 1
   */
  topP?: number;

  /**
   * Maximum number of tokens to generate.
   */
  maxOutputTokens?: number;

  /**
   * Whether to store the input messages and response.
   * @default true
   */
  store?: boolean;

  /**
   * A unique identifier representing your end-user.
   */
  user?: string;

  /**
   * The base URL for the xAI API.
   * @default "https://api.x.ai/v1"
   */
  baseURL?: string;

  /**
   * Default search parameters for xAI's search capabilities.
   */
  searchParameters?: XAIResponsesSearchParameters;

  /**
   * Default reasoning configuration.
   */
  reasoning?: XAIResponsesReasoning;
}

/**
 * Invocation parameters for ChatXAIResponses (request params without input).
 */
export type ChatXAIResponsesInvocationParams = Omit<
  XAIResponsesCreateParams,
  "input"
>;
