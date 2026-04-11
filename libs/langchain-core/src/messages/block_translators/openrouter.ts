import { AIMessage } from "../ai.js";
import { ContentBlock } from "../content/index.js";
import type { StandardContentBlockTranslator } from "./index.js";
import { _isString } from "./utils.js";

/**
 * Converts an OpenRouter AI message to an array of v1 standard content blocks.
 *
 * OpenRouter returns reasoning output through two places on the Chat
 * Completions response:
 *
 * 1. `message.reasoning` / `delta.reasoning` — a flat string that summarizes
 *    the model's chain of thought. The `@langchain/openrouter` converter
 *    normalizes this into `additional_kwargs.reasoning_content` so it matches
 *    the DeepSeek convention already used elsewhere in LangChain.
 * 2. `message.reasoning_details` / `delta.reasoning_details` — a structured
 *    array of provider-specific reasoning artifacts (see the
 *    `reasoning.summary` / `reasoning.encrypted` / `reasoning.text` union in
 *    the OpenRouter API types). The converter preserves these verbatim under
 *    `additional_kwargs.reasoning_details` for round-tripping back to the
 *    provider on subsequent turns (e.g. Anthropic extended thinking requires
 *    the original `signature` to be echoed back).
 *
 * This translator prefers the structured `reasoning_details` form when
 * present (so no information is lost), and falls back to the flat
 * `reasoning_content` string otherwise.
 *
 * @param message - The AI message containing OpenRouter-formatted content
 * @returns Array of content blocks in v1 standard format
 *
 * @example
 * ```typescript
 * const message = new AIMessage({
 *   content: "The answer is 42",
 *   additional_kwargs: { reasoning_content: "Let me think about this..." },
 *   response_metadata: { model_provider: "openrouter" },
 * });
 * message.contentBlocks;
 * // [
 * //   { type: "reasoning", reasoning: "Let me think about this..." },
 * //   { type: "text", text: "The answer is 42" }
 * // ]
 * ```
 */
export function convertToV1FromOpenRouterMessage(
  message: AIMessage
): Array<ContentBlock.Standard> {
  const blocks: Array<ContentBlock.Standard> = [];

  // Prefer structured reasoning_details when present — they can carry
  // multiple distinct reasoning artifacts (summary, encrypted, text).
  const reasoningDetails = message.additional_kwargs?.reasoning_details;
  if (Array.isArray(reasoningDetails) && reasoningDetails.length > 0) {
    for (const detail of reasoningDetails) {
      if (detail == null || typeof detail !== "object") continue;
      const type = (detail as { type?: unknown }).type;
      if (type === "reasoning.summary") {
        const summary = (detail as { summary?: unknown }).summary;
        if (_isString(summary) && summary.length > 0) {
          blocks.push({ type: "reasoning", reasoning: summary });
        }
      } else if (type === "reasoning.text") {
        const text = (detail as { text?: unknown }).text;
        if (_isString(text) && text.length > 0) {
          blocks.push({ type: "reasoning", reasoning: text });
        }
      }
      // `reasoning.encrypted` details carry no human-readable text (only an
      // opaque `data` blob that must be echoed back to the provider), so they
      // do not become visible reasoning blocks. They stay in
      // `additional_kwargs.reasoning_details` for round-tripping.
    }
  } else {
    // Fall back to the flat `reasoning_content` string (the DeepSeek-style
    // convention that `@langchain/openrouter` normalizes to when no
    // structured details are present).
    const reasoningContent = message.additional_kwargs?.reasoning_content;
    if (_isString(reasoningContent) && reasoningContent.length > 0) {
      blocks.push({
        type: "reasoning",
        reasoning: reasoningContent,
      });
    }
  }

  // Handle text content (string or multi-block array).
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

  // Add tool calls if present.
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

export const ChatOpenRouterTranslator: StandardContentBlockTranslator = {
  translateContent: convertToV1FromOpenRouterMessage,
  translateContentChunk: convertToV1FromOpenRouterMessage,
};
