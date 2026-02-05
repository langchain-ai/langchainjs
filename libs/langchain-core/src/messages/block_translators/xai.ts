import { AIMessage } from "../ai.js";
import { ContentBlock } from "../content/index.js";
import type { StandardContentBlockTranslator } from "./index.js";
import { _isArray, _isObject, _isString } from "./utils.js";

/**
 * Converts an xAI AI message to an array of v1 standard content blocks.
 *
 * This function processes an AI message from xAI's API format
 * and converts it to the standardized v1 content block format. It handles
 * both the responses API (reasoning object with summary) and completions API
 * (reasoning_content string) formats.
 *
 * @param message - The AI message containing xAI-formatted content
 * @returns Array of content blocks in v1 standard format
 *
 * @example
 * ```typescript
 * // Responses API format
 * const message = new AIMessage({
 *   content: "The answer is 42",
 *   additional_kwargs: {
 *     reasoning: {
 *       id: "reasoning_123",
 *       type: "reasoning",
 *       summary: [{ type: "summary_text", text: "Let me think..." }]
 *     }
 *   }
 * });
 * const standardBlocks = convertToV1FromXAIMessage(message);
 * // Returns:
 * // [
 * //   { type: "reasoning", reasoning: "Let me think..." },
 * //   { type: "text", text: "The answer is 42" }
 * // ]
 * ```
 *
 * @example
 * ```typescript
 * // Completions API format
 * const message = new AIMessage({
 *   content: "The answer is 42",
 *   additional_kwargs: { reasoning_content: "Let me think about this..." }
 * });
 * const standardBlocks = convertToV1FromXAIMessage(message);
 * // Returns:
 * // [
 * //   { type: "reasoning", reasoning: "Let me think about this..." },
 * //   { type: "text", text: "The answer is 42" }
 * // ]
 * ```
 */
export function convertToV1FromXAIMessage(
  message: AIMessage
): Array<ContentBlock.Standard> {
  const blocks: Array<ContentBlock.Standard> = [];

  // Check for Responses API format: additional_kwargs.reasoning with summary array
  if (_isObject(message.additional_kwargs?.reasoning)) {
    const reasoning = message.additional_kwargs.reasoning;
    if (_isArray(reasoning.summary)) {
      const summaryText = reasoning.summary.reduce<string>((acc, item) => {
        if (_isObject(item) && _isString(item.text)) {
          return `${acc}${item.text}`;
        }
        return acc;
      }, "");
      if (summaryText.length > 0) {
        blocks.push({
          type: "reasoning",
          reasoning: summaryText,
        });
      }
    }
  }

  // Check for Completions API format: additional_kwargs.reasoning_content
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

export const ChatXAITranslator: StandardContentBlockTranslator = {
  translateContent: convertToV1FromXAIMessage,
  translateContentChunk: convertToV1FromXAIMessage,
};
