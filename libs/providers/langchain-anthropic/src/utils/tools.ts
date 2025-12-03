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
});

/**
 * Mapping of Anthropic tool types to their required beta feature flags.
 *
 * This constant defines which beta header is needed for specific tool types
 * when making requests to the Anthropic API. Beta features are experimental
 * capabilities that may change or be removed.
 */
export const ANTHROPIC_TOOL_BETAS: Record<string, string> = {
  tool_search_tool_regex_20251119: "advanced-tool-use-2025-11-20",
  tool_search_tool_bm25_20251119: "advanced-tool-use-2025-11-20",
};
