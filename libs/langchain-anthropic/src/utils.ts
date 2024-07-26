import type {
  MessageCreateParams,
  Tool as AnthropicTool,
} from "@anthropic-ai/sdk/resources/index.mjs";
import { ToolDefinition } from "@langchain/core/language_models/base";
import { RunnableToolLike } from "@langchain/core/runnables";
import { StructuredToolInterface } from "@langchain/core/tools";

export type AnthropicToolChoice =
  | {
      type: "tool";
      name: string;
    }
  | "any"
  | "auto"
  | "none"
  | string;

export type AnthropicToolTypes =
  | StructuredToolInterface
  | AnthropicTool
  | Record<string, unknown>
  | ToolDefinition
  | RunnableToolLike;

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
