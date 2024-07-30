import type { MessageCreateParams } from "@anthropic-ai/sdk/resources/index.mjs";
import { AIMessageChunk } from "@langchain/core/messages";
import { ToolCallChunk } from "@langchain/core/messages/tool";
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

export function extractToolCallChunk(
  chunk: AIMessageChunk
): ToolCallChunk | undefined {
  let newToolCallChunk: ToolCallChunk | undefined;

  // Initial chunk for tool calls from anthropic contains identifying information like ID and name.
  // This chunk does not contain any input JSON.
  const toolUseChunks = Array.isArray(chunk.content)
    ? chunk.content.find((c) => c.type === "tool_use")
    : undefined;
  if (
    toolUseChunks &&
    "index" in toolUseChunks &&
    "name" in toolUseChunks &&
    "id" in toolUseChunks
  ) {
    newToolCallChunk = {
      args: "",
      id: toolUseChunks.id,
      name: toolUseChunks.name,
      index: toolUseChunks.index,
      type: "tool_call_chunk",
    };
  }

  // Chunks after the initial chunk only contain the index and partial JSON.
  const inputJsonDeltaChunks = Array.isArray(chunk.content)
    ? chunk.content.find((c) => c.type === "input_json_delta")
    : undefined;
  if (
    inputJsonDeltaChunks &&
    "index" in inputJsonDeltaChunks &&
    "input" in inputJsonDeltaChunks
  ) {
    if (typeof inputJsonDeltaChunks.input === "string") {
      newToolCallChunk = {
        id: inputJsonDeltaChunks.id,
        name: inputJsonDeltaChunks.name,
        args: inputJsonDeltaChunks.input,
        index: inputJsonDeltaChunks.index,
        type: "tool_call_chunk",
      };
    } else {
      newToolCallChunk = {
        id: inputJsonDeltaChunks.id,
        name: inputJsonDeltaChunks.name,
        args: JSON.stringify(inputJsonDeltaChunks.input, null, 2),
        index: inputJsonDeltaChunks.index,
        type: "tool_call_chunk",
      };
    }
  }

  return newToolCallChunk;
}
