import type { FinishReason } from "@langchain/core/language_models/event";

/**
 * Maps a Chat Completions `finish_reason` to the standardized value.
 * @internal
 */
export function normalizeCompletionsFinishReason(
  finishReason: string,
  options: { hasToolCalls?: boolean; hasRefusal?: boolean } = {}
): FinishReason {
  if (options.hasRefusal) return "refusal";
  switch (finishReason) {
    case "stop":
      // A forced `tool_choice` ends with `stop` despite returning tool calls.
      return options.hasToolCalls ? "tool_call" : "stop";
    case "length":
      return "length";
    case "tool_calls":
    case "function_call":
      return "tool_call";
    case "content_filter":
      return "content_filter";
    default:
      return "other";
  }
}

/**
 * Maps a Responses API `status` to the standardized finish reason.
 * @internal
 */
export function normalizeResponseStatus(
  status: string,
  incompleteReason: string | null | undefined,
  options: { hasToolCalls?: boolean; hasRefusal?: boolean } = {}
): FinishReason {
  // OpenAI refuses with a normal `completed` status.
  if (options.hasRefusal) return "refusal";
  if (status === "completed") {
    return options.hasToolCalls ? "tool_call" : "stop";
  }
  if (status === "incomplete") {
    if (incompleteReason === "max_output_tokens") return "length";
    if (incompleteReason === "content_filter") return "content_filter";
    return "other";
  }
  if (status === "failed") return "error";
  return "other";
}

/**
 * Whether a Responses API `output` array contains a refusal part.
 * @internal
 */
export function hasRefusalOutput(output: unknown): boolean {
  if (!Array.isArray(output)) return false;
  return output.some(
    (item) =>
      item?.type === "message" &&
      Array.isArray(item.content) &&
      item.content.some(
        (part: { type?: string } | null) => part?.type === "refusal"
      )
  );
}
