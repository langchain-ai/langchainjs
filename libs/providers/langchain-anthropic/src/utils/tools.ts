import type { Anthropic } from "@anthropic-ai/sdk";
import * as z from "zod/v4";
import { AnthropicToolChoice } from "../types.js";

export function handleToolChoice(
  toolChoice?: AnthropicToolChoice
):
  | Anthropic.Messages.ToolChoiceAuto
  | Anthropic.Messages.ToolChoiceAny
  | Anthropic.Messages.ToolChoiceTool
  | Anthropic.Messages.ToolChoiceNone
  | undefined {
  if (!toolChoice) {
    return undefined;
  } else if (toolChoice === "any") {
    return {
      type: "any",
    };
  } else if (toolChoice === "auto") {
    return {
      type: "auto",
    };
  } else if (toolChoice === "none") {
    return {
      type: "none",
    };
  } else if (typeof toolChoice === "string") {
    return {
      type: "tool",
      name: toolChoice,
    };
  } else {
    return toolChoice;
  }
}

export const AnthropicToolExtrasSchema = z.object({
  cache_control: z
    .custom<Anthropic.Messages.CacheControlEphemeral>()
    .optional()
    .nullable(),
  defer_loading: z.boolean().optional(),
  input_examples: z.array(z.unknown()).optional(),
  allowed_callers: z.array(z.unknown()).optional(),
});

/**
 * Mapping of Anthropic tool types to their required beta feature flags.
 *
 * This constant defines which beta header is needed for specific tool types
 * when making requests to the Anthropic API. Beta features are experimental
 * capabilities that may change or be removed.
 */
/**
 * Checks whether any tools have `allowed_callers` referencing code execution,
 * which requires the `advanced-tool-use-2025-11-20` beta header.
 */
export function getToolsRequiringAdvancedBeta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: any[] | undefined
): boolean {
  if (!tools) return false;
  return tools.some((tool) => {
    // Raw Anthropic tool definition with allowed_callers
    if (typeof tool === "object" && tool != null && "allowed_callers" in tool) {
      const callers = tool.allowed_callers as string[] | undefined;
      return callers?.some((c: string) => c.startsWith("code_execution"));
    }
    // LangChain tool with extras
    if (
      typeof tool === "object" &&
      tool != null &&
      "extras" in tool &&
      tool.extras?.allowed_callers
    ) {
      const callers = tool.extras.allowed_callers as string[] | undefined;
      return callers?.some((c: string) => c.startsWith("code_execution"));
    }
    return false;
  });
}

export const ANTHROPIC_TOOL_BETAS: Record<string, string> = {
  tool_search_tool_regex_20251119: "advanced-tool-use-2025-11-20",
  tool_search_tool_bm25_20251119: "advanced-tool-use-2025-11-20",
  memory_20250818: "context-management-2025-06-27",
  web_fetch_20250910: "web-fetch-2025-09-10",
  code_execution_20250825: "code-execution-2025-08-25",
  computer_20251124: "computer-use-2025-11-24",
  computer_20250124: "computer-use-2025-01-24",
  mcp_toolset: "mcp-client-2025-11-20",
};
