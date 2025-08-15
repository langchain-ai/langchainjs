import { ToolCall, ToolMessage, isDirectToolOutput } from "../messages/tool.js";
import type { ToolOutputType } from "./types.js";

/**
 * Type guard that checks if a value is a valid ToolCall object.
 *
 * @param toolCall - The value to check
 * @returns True if the value is a ToolCall object with type "tool_call", false otherwise
 */
export function isToolCall(toolCall?: unknown): toolCall is ToolCall {
  return !!(
    toolCall &&
    typeof toolCall === "object" &&
    "type" in toolCall &&
    toolCall.type === "tool_call"
  );
}

/**
 * Type guard that checks if a config object contains a toolCall property with an id.
 *
 * @param config - The configuration object to check
 * @returns True if the config has a toolCall object with a string id property, false otherwise
 */
export function configHasToolCallId(
  config?: unknown
): config is { toolCall: { id?: string } } {
  return !!(
    config &&
    typeof config === "object" &&
    "toolCall" in config &&
    config.toolCall != null &&
    typeof config.toolCall === "object" &&
    "id" in config.toolCall &&
    typeof config.toolCall.id === "string"
  );
}

/**
 * Custom error class used to handle exceptions related to tool input parsing.
 * It extends the built-in `Error` class and adds an optional `output`
 * property that can hold the output that caused the exception.
 */
export class ToolInputParsingException extends Error {
  output?: string;

  constructor(message: string, output?: string) {
    super(message);
    this.output = output;
  }
}

/**
 * Formats tool output based on whether a tool call ID is present.
 *
 * This internal function handles the conversion of tool execution results into
 * the appropriate format for the LangChain message system. When a tool call ID
 * is provided (indicating the tool was invoked as part of an agent interaction),
 * it wraps the output in a ToolMessage. Otherwise, it returns the raw output.
 *
 * @internal
 * @template TOutput - The type of the tool's output content
 * @param params - The formatting parameters
 * @param params.content - The raw output from the tool execution
 * @param params.name - The name of the tool that produced this output
 * @param params.artifact - Optional artifact data associated with the tool output
 * @param params.toolCallId - Optional ID linking this output to a specific tool call
 * @returns Either a ToolMessage (when toolCallId is provided and content is not DirectToolOutput)
 *          or the original content
 *
 * @example
 * ```typescript
 * // With tool call ID - returns ToolMessage
 * const result = formatToolOutput({
 *   content: "Search completed",
 *   name: "web-search",
 *   toolCallId: "call_123"
 * });
 * // result is ToolMessage instance
 *
 * // Without tool call ID - returns raw content
 * const result = formatToolOutput({
 *   content: { data: "results" },
 *   name: "calculator"
 * });
 * // result is { data: "results" }
 * ```
 */
export function formatToolOutput<TOutput extends ToolOutputType>(params: {
  content: TOutput;
  name: string;
  artifact?: unknown;
  toolCallId?: string;
}): ToolMessage | TOutput {
  const { content, artifact, toolCallId } = params;

  // Early return if no toolCallId or content is DirectToolOutput
  if (!toolCallId || isDirectToolOutput(content)) {
    return content;
  }

  // Check if content can be used directly in ToolMessage
  const canUseContentDirectly =
    typeof content === "string" ||
    (Array.isArray(content) &&
      content.every((item) => typeof item === "object"));

  // Create ToolMessage with appropriate content format
  return new ToolMessage({
    content: canUseContentDirectly ? content : safeStringify(content),
    artifact,
    tool_call_id: toolCallId,
    name: params.name,
  });
}

/**
 * Safely converts any value to a string representation.
 *
 * @internal
 * @param content - Any value to be converted to a string
 * @returns A string representation of the content. Returns a pretty-printed JSON
 *          string if possible, otherwise falls back to template literal conversion.
 *
 * @see {@link JSON.stringify} for details on JSON serialization behavior
 */
export function safeStringify(content: unknown): string {
  try {
    return JSON.stringify(content, null, 2) ?? "";
  } catch (_noOp) {
    return `${content}`;
  }
}
