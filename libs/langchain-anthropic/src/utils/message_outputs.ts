/**
 * This util file contains functions for converting Anthropic messages to LangChain messages.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  AIMessage,
  AIMessageChunk,
  UsageMetadata,
} from "@langchain/core/messages";
import type { ToolCallChunk } from "@langchain/core/messages/tool";
import { ChatGeneration } from "@langchain/core/outputs";
import { AnthropicMessageResponse } from "../types.js";
import { extractToolCalls } from "../output_parsers.js";

export function _makeMessageChunkFromAnthropicEvent(
  data: Anthropic.Messages.RawMessageStreamEvent,
  fields: {
    streamUsage: boolean;
    coerceContentToString: boolean;
  }
): {
  chunk: AIMessageChunk;
} | null {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { input_tokens, output_tokens, ...rest }: Record<string, any> =
      usage ?? {};
    const usageMetadata: UsageMetadata = {
      input_tokens,
      output_tokens,
      total_tokens: input_tokens + output_tokens,
      input_token_details: {
        cache_creation: rest.cache_creation_input_tokens,
        cache_read: rest.cache_read_input_tokens,
      },
    };
    return {
      chunk: new AIMessageChunk({
        content: fields.coerceContentToString ? "" : [],
        additional_kwargs: filteredAdditionalKwargs,
        usage_metadata: fields.streamUsage ? usageMetadata : undefined,
        response_metadata: {
          usage: {
            ...rest,
          },
        },
        id: data.message.id,
      }),
    };
  } else if (data.type === "message_delta") {
    const usageMetadata: UsageMetadata = {
      input_tokens: 0,
      output_tokens: data.usage.output_tokens,
      total_tokens: data.usage.output_tokens,
      input_token_details: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cache_creation: (data.usage as any).cache_creation_input_tokens,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cache_read: (data.usage as any).cache_read_input_tokens,
      },
    };
    return {
      chunk: new AIMessageChunk({
        content: fields.coerceContentToString ? "" : [],
        additional_kwargs: { ...data.delta },
        usage_metadata: fields.streamUsage ? usageMetadata : undefined,
      }),
    };
  } else if (
    data.type === "content_block_start" &&
    [
      "tool_use",
      "document",
      "server_tool_use",
      "web_search_tool_result",
    ].includes(data.content_block.type)
  ) {
    const contentBlock = data.content_block;
    let toolCallChunks: ToolCallChunk[];
    if (contentBlock.type === "tool_use") {
      toolCallChunks = [
        {
          id: contentBlock.id,
          index: data.index,
          name: contentBlock.name,
          args: "",
        },
      ];
    } else {
      toolCallChunks = [];
    }
    return {
      chunk: new AIMessageChunk({
        content: fields.coerceContentToString
          ? ""
          : [
              {
                index: data.index,
                ...data.content_block,
                input:
                  contentBlock.type === "server_tool_use" ||
                  contentBlock.type === "tool_use"
                    ? ""
                    : undefined,
              },
            ],
        additional_kwargs: {},
        tool_call_chunks: toolCallChunks,
      }),
    };
  } else if (
    data.type === "content_block_delta" &&
    [
      "text_delta",
      "citations_delta",
      "thinking_delta",
      "signature_delta",
    ].includes(data.delta.type)
  ) {
    if (fields.coerceContentToString && "text" in data.delta) {
      return {
        chunk: new AIMessageChunk({
          content: data.delta.text,
        }),
      };
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contentBlock: Record<string, any> = data.delta;
      if ("citation" in contentBlock) {
        contentBlock.citations = [contentBlock.citation];
        delete contentBlock.citation;
      }
      if (
        contentBlock.type === "thinking_delta" ||
        contentBlock.type === "signature_delta"
      ) {
        return {
          chunk: new AIMessageChunk({
            content: [{ index: data.index, ...contentBlock, type: "thinking" }],
          }),
        };
      }

      return {
        chunk: new AIMessageChunk({
          content: [{ index: data.index, ...contentBlock, type: "text" }],
        }),
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
        tool_call_chunks: [
          {
            index: data.index,
            args: data.delta.partial_json,
          },
        ],
      }),
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
      };
    }
  } else if (
    data.type === "content_block_start" &&
    data.content_block.type === "redacted_thinking"
  ) {
    return {
      chunk: new AIMessageChunk({
        content: fields.coerceContentToString
          ? ""
          : [{ index: data.index, ...data.content_block }],
      }),
    };
  } else if (
    data.type === "content_block_start" &&
    data.content_block.type === "thinking"
  ) {
    const content = data.content_block.thinking;
    return {
      chunk: new AIMessageChunk({
        content: fields.coerceContentToString
          ? content
          : [{ index: data.index, ...data.content_block }],
      }),
    };
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
          input_token_details: {
            cache_creation: usage.cache_creation_input_tokens,
            cache_read: usage.cache_read_input_tokens,
          },
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
