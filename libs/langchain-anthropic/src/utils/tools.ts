import type { MessageCreateParams } from "@anthropic-ai/sdk/resources/index.mjs";
import { AnthropicToolChoice } from "../types.js";

export function handleToolChoice(
  toolChoice?: AnthropicToolChoice
):
  | MessageCreateParams.ToolChoiceAuto
  | MessageCreateParams.ToolChoiceAny
  | MessageCreateParams.ToolChoiceTool
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
  } else if (typeof toolChoice === "string") {
    return {
      type: "tool",
      name: toolChoice,
    };
  } else {
    return toolChoice;
  }
}
