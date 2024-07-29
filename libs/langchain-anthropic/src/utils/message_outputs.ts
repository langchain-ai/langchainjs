/**
 * This util file contains functions for converting Anthropic messages to LangChain messages.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  AIMessage,
  AIMessageChunk,
  UsageMetadata,
} from "@langchain/core/messages";
import { ChatGeneration } from "@langchain/core/outputs";
import { AnthropicMessageResponse } from "../types.js";
import { extractToolCalls } from "../output_parsers.js";

export function _makeMessageChunkFromAnthropicEvent(
  data: Anthropic.Messages.RawMessageStreamEvent,
  fields: {
    streamUsage: boolean;
    coerceContentToString: boolean;
    usageData: { input_tokens: number; output_tokens: number };
  }
): {
  chunk: AIMessageChunk;
  usageData: { input_tokens: number; output_tokens: number };
} | null {
  let usageDataCopy = { ...fields.usageData };

  if (data.type === "message_start") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { content, usage, ...additionalKwargs } = data.message;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filteredAdditionalKwargs: Record<string, any> = {};
    for (const [key, value] of Object.entries(additionalKwargs)) {
      if (value !== undefined && value !== null) {
        filteredAdditionalKwargs[key] = value;
      }
    }
    usageDataCopy = usage;
    let usageMetadata: UsageMetadata | undefined;
    if (fields.streamUsage) {
      usageMetadata = {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        total_tokens: usage.input_tokens + usage.output_tokens,
      };
    }
    return {
      chunk: new AIMessageChunk({
        content: fields.coerceContentToString ? "" : [],
        additional_kwargs: filteredAdditionalKwargs,
        usage_metadata: usageMetadata,
        id: data.message.id,
      }),
      usageData: usageDataCopy,
    };
  } else if (data.type === "message_delta") {
    let usageMetadata: UsageMetadata | undefined;
    if (fields.streamUsage) {
      usageMetadata = {
        input_tokens: data.usage.output_tokens,
        output_tokens: 0,
        total_tokens: data.usage.output_tokens,
      };
    }
    if (data?.usage !== undefined) {
      usageDataCopy.output_tokens += data.usage.output_tokens;
    }
    return {
      chunk: new AIMessageChunk({
        content: fields.coerceContentToString ? "" : [],
        additional_kwargs: { ...data.delta },
        usage_metadata: usageMetadata,
      }),
      usageData: usageDataCopy,
    };
  } else if (
    data.type === "content_block_start" &&
    data.content_block.type === "tool_use"
  ) {
    return {
      chunk: new AIMessageChunk({
        content: fields.coerceContentToString
          ? ""
          : [
              {
                index: data.index,
                ...data.content_block,
                input: "",
              },
            ],
        additional_kwargs: {},
      }),
      usageData: usageDataCopy,
    };
  } else if (
    data.type === "content_block_delta" &&
    data.delta.type === "text_delta"
  ) {
    const content = data.delta?.text;
    if (content !== undefined) {
      return {
        chunk: new AIMessageChunk({
          content: fields.coerceContentToString
            ? content
            : [
                {
                  index: data.index,
                  ...data.delta,
                },
              ],
          additional_kwargs: {},
        }),
        usageData: usageDataCopy,
      };
    }
  } else if (
    data.type === "content_block_delta" &&
    data.delta.type === "input_json_delta"
  ) {
    return {
      chunk: new AIMessageChunk({
        content: fields.coerceContentToString
          ? ""
          : [
              {
                index: data.index,
                input: data.delta.partial_json,
                type: data.delta.type,
              },
            ],
        additional_kwargs: {},
      }),
      usageData: usageDataCopy,
    };
  } else if (
    data.type === "content_block_start" &&
    data.content_block.type === "text"
  ) {
    const content = data.content_block?.text;
    if (content !== undefined) {
      return {
        chunk: new AIMessageChunk({
          content: fields.coerceContentToString
            ? content
            : [
                {
                  index: data.index,
                  ...data.content_block,
                },
              ],
          additional_kwargs: {},
        }),
        usageData: usageDataCopy,
      };
    }
  }

  return null;
}

export function anthropicResponseToChatMessages(
  messages: AnthropicMessageResponse[],
  additionalKwargs: Record<string, unknown>
): ChatGeneration[] {
  const usage: Record<string, number> | null | undefined =
    additionalKwargs.usage as Record<string, number> | null | undefined;
  const usageMetadata =
    usage != null
      ? {
          input_tokens: usage.input_tokens ?? 0,
          output_tokens: usage.output_tokens ?? 0,
          total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
        }
      : undefined;
  if (messages.length === 1 && messages[0].type === "text") {
    return [
      {
        text: messages[0].text,
        message: new AIMessage({
          content: messages[0].text,
          additional_kwargs: additionalKwargs,
          usage_metadata: usageMetadata,
          response_metadata: additionalKwargs,
          id: additionalKwargs.id as string,
        }),
      },
    ];
  } else {
    const toolCalls = extractToolCalls(messages);
    const generations: ChatGeneration[] = [
      {
        text: "",
        message: new AIMessage({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: messages as any,
          additional_kwargs: additionalKwargs,
          tool_calls: toolCalls,
          usage_metadata: usageMetadata,
          response_metadata: additionalKwargs,
          id: additionalKwargs.id as string,
        }),
      },
    ];
    return generations;
  }
}
