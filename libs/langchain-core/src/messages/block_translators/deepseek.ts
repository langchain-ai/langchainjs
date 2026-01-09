import { AIMessage } from "../ai.js";
import { ContentBlock } from "../content/index.js";
import type { StandardContentBlockTranslator } from "./index.js";
import { _isString } from "./utils.js";

/**
 * Converts a DeepSeek AI message to an array of v1 standard content blocks.
 *
 * This function processes an AI message from DeepSeek's API format
 * and converts it to the standardized v1 content block format. It handles
 * both string content and the reasoning_content in additional_kwargs.
 *
 * @param message - The AI message containing DeepSeek-formatted content
 * @returns Array of content blocks in v1 standard format
 *
 * @example
 * ```typescript
 * const message = new AIMessage({
 *   content: "The answer is 42",
 *   additional_kwargs: { reasoning_content: "Let me think about this..." }
 * });
 * const standardBlocks = convertToV1FromDeepSeekMessage(message);
 * // Returns:
 * // [
 * //   { type: "reasoning", reasoning: "Let me think about this..." },
 * //   { type: "text", text: "The answer is 42" }
 * // ]
 * ```
 */
export function convertToV1FromDeepSeekMessage(
  message: AIMessage
): Array<ContentBlock.Standard> {
  const blocks: Array<ContentBlock.Standard> = [];

  // Extract reasoning from additional_kwargs.reasoning_content
  const reasoningContent = message.additional_kwargs?.reasoning_content;
  if (_isString(reasoningContent) && reasoningContent.length > 0) {
    blocks.push({
      type: "reasoning",
      reasoning: reasoningContent,
    });
  }

  // Handle text content
  if (typeof message.content === "string") {
    if (message.content.length > 0) {
      blocks.push({
        type: "text",
        text: message.content,
      });
    }
  } else {
    for (const block of message.content) {
      if (
        typeof block === "object" &&
        "type" in block &&
        block.type === "text" &&
        "text" in block &&
        _isString(block.text)
      ) {
        blocks.push({
          type: "text",
          text: block.text,
        });
      }
    }
  }

  // Add tool calls if present
  for (const toolCall of message.tool_calls ?? []) {
    blocks.push({
      type: "tool_call",
      id: toolCall.id,
      name: toolCall.name,
      args: toolCall.args,
    });
  }

  return blocks;
}

export const ChatDeepSeekTranslator: StandardContentBlockTranslator = {
  translateContent: convertToV1FromDeepSeekMessage,
  translateContentChunk: convertToV1FromDeepSeekMessage,
};
