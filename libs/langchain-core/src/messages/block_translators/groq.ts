import { AIMessage } from "../ai.js";
import { ContentBlock } from "../content/index.js";
import type { StandardContentBlockTranslator } from "./index.js";
import { _isString } from "./utils.js";

/**
 * Converts a Groq AI message to an array of v1 standard content blocks.
 *
 * This function processes an AI message from Groq's API format
 * and converts it to the standardized v1 content block format. It handles
 * both parsed reasoning (in additional_kwargs.reasoning) and raw reasoning
 * (in <think> tags within content).
 *
 * @param message - The AI message containing Groq-formatted content
 * @returns Array of content blocks in v1 standard format
 *
 * @example
 * ```typescript
 * // Parsed format (reasoning_format="parsed")
 * const message = new AIMessage({
 *   content: "The answer is 42",
 *   additional_kwargs: { reasoning: "Let me think about this..." }
 * });
 * const standardBlocks = convertToV1FromGroqMessage(message);
 * // Returns:
 * // [
 * //   { type: "reasoning", reasoning: "Let me think about this..." },
 * //   { type: "text", text: "The answer is 42" }
 * // ]
 * ```
 *
 * @example
 * ```typescript
 * // Raw format (reasoning_format="raw")
 * const message = new AIMessage({
 *   content: "<think>Let me think...</think>The answer is 42"
 * });
 * const standardBlocks = convertToV1FromGroqMessage(message);
 * // Returns:
 * // [
 * //   { type: "reasoning", reasoning: "Let me think..." },
 * //   { type: "text", text: "The answer is 42" }
 * // ]
 * ```
 */
export function convertToV1FromGroqMessage(
  message: AIMessage
): Array<ContentBlock.Standard> {
  const blocks: Array<ContentBlock.Standard> = [];

  // Check for parsed reasoning format in additional_kwargs.reasoning
  const parsedReasoning = message.additional_kwargs?.reasoning;
  if (_isString(parsedReasoning) && parsedReasoning.length > 0) {
    blocks.push({
      type: "reasoning",
      reasoning: parsedReasoning,
    });
  }

  // Handle text content
  if (typeof message.content === "string") {
    let textContent = message.content;

    // Check for raw reasoning format with <think> tags
    const thinkMatch = textContent.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      const thinkingContent = thinkMatch[1].trim();
      if (thinkingContent.length > 0) {
        blocks.push({
          type: "reasoning",
          reasoning: thinkingContent,
        });
      }
      // Remove the think tags from the text content
      textContent = textContent.replace(/<think>[\s\S]*?<\/think>/, "").trim();
    }

    if (textContent.length > 0) {
      blocks.push({
        type: "text",
        text: textContent,
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
        let textContent = block.text;

        // Check for raw reasoning format with <think> tags
        const thinkMatch = textContent.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch) {
          const thinkingContent = thinkMatch[1].trim();
          if (thinkingContent.length > 0) {
            blocks.push({
              type: "reasoning",
              reasoning: thinkingContent,
            });
          }
          textContent = textContent
            .replace(/<think>[\s\S]*?<\/think>/, "")
            .trim();
        }

        if (textContent.length > 0) {
          blocks.push({
            type: "text",
            text: textContent,
          });
        }
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

export const ChatGroqTranslator: StandardContentBlockTranslator = {
  translateContent: convertToV1FromGroqMessage,
  translateContentChunk: convertToV1FromGroqMessage,
};
