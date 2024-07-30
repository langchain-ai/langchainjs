import type {
  MessageCreateParams,
  Tool as AnthropicTool,
} from "@anthropic-ai/sdk/resources/index.mjs";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";

export type AnthropicToolChoice =
  | {
      type: "tool";
      name: string;
    }
  | "any"
  | "auto"
  | "none"
  | string;

export type AnthropicToolTypes = BindToolsInput | AnthropicTool;

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
