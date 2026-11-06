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
import { _isAnthropicCompactionBlock } from "./content.js";
import { iife } from "./index.js";

/** Raw Anthropic token counts, as reported on `message_start` and `message_delta`. */
export type AnthropicUsageCounts = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
};

/** Usage reported so far for one streamed response. */
export type AnthropicStreamUsageState = {
  reported?: AnthropicUsageCounts;
  serverToolUse?: Record<string, number>;
};

const CUMULATIVE_USAGE_KEYS = [
  "input_tokens",
  "output_tokens",
  "cache_creation_input_tokens",
  "cache_read_input_tokens",
] as const;

/**
 * Applies a streamed usage object on top of the usage reported so far.
 *
 * `message_delta` usage is cumulative for the whole request, and fields that
 * are omitted or null are unchanged. Server tools (e.g. web search) run extra
 * model passes inside one request, so input and cache counts can grow after
 * `message_start`.
 * ref: https://platform.claude.com/docs/en/build-with-claude/streaming#event-types
 */
export function _mergeCumulativeAnthropicUsage(
  previous: AnthropicUsageCounts | undefined,
  next: Partial<Record<keyof AnthropicUsageCounts, number | null>>
): AnthropicUsageCounts {
  const merged: AnthropicUsageCounts = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    ...previous,
  };
  for (const key of CUMULATIVE_USAGE_KEYS) {
    const value = next[key];
    if (value != null) {
      merged[key] = value;
    }
  }
  return merged;
}

export function _makeMessageChunkFromAnthropicEvent(
  data: Anthropic.Beta.Messages.BetaRawMessageStreamEvent,
  fields: {
    streamUsage: boolean;
    coerceContentToString: boolean;
    /**
     * Shared across the events of one response. `message_delta` chunks carry
     * the difference from the usage already reported, so concatenating the
     * chunks gives Anthropic's final cumulative totals.
     */
    usageState: AnthropicStreamUsageState;
  }
): {
  chunk: AIMessageChunk;
} | null {
  const response_metadata = { model_provider: "anthropic" };
  if (data.type === "message_start") {
    const { content, usage, ...additionalKwargs } = data.message;
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const filteredAdditionalKwargs: Record<string, any> = {};
    for (const [key, value] of Object.entries(additionalKwargs)) {
      if (value !== undefined && value !== null) {
        filteredAdditionalKwargs[key] = value;
      }
    }
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const { input_tokens, output_tokens, ...rest }: Record<string, any> =
      usage ?? {};
    const usageMetadata = buildUsageMetadata(usage);
    fields.usageState.reported = _mergeCumulativeAnthropicUsage(
      undefined,
      usage ?? {}
    );
    fields.usageState.serverToolUse = usage?.server_tool_use
      ? { ...usage.server_tool_use }
      : undefined;
    return {
      chunk: new AIMessageChunk({
        content: fields.coerceContentToString ? "" : [],
        additional_kwargs: filteredAdditionalKwargs,
        usage_metadata: fields.streamUsage ? usageMetadata : undefined,
        response_metadata: {
          ...response_metadata,
          usage: {
            ...rest,
          },
        },
        id: data.message.id,
      }),
    };
  } else if (data.type === "message_delta") {
    const previous =
      fields.usageState.reported ??
      _mergeCumulativeAnthropicUsage(undefined, {});
    const current = _mergeCumulativeAnthropicUsage(previous, data.usage);
    fields.usageState.reported = current;
    const usageDiff = Object.fromEntries(
      CUMULATIVE_USAGE_KEYS.map((key) => [key, current[key] - previous[key]])
    ) as AnthropicUsageCounts;
    const usageMetadata = buildUsageMetadata(usageDiff);
    const responseMetadata = iife(() => {
      const output = {};
      if ("context_management" in data.delta) {
        output["context_management"] = data.delta.context_management;
      }
      // `response_metadata.usage` starts from `message_start` and is summed on
      // concat, so this carries the difference from the cumulative delta.
      const usage: Record<string, unknown> = {};
      for (const key of [
        "cache_creation_input_tokens",
        "cache_read_input_tokens",
      ] as const) {
        if (usageDiff[key] !== 0) {
          usage[key] = usageDiff[key];
        }
      }
      const serverToolUse = data.usage.server_tool_use;
      if (serverToolUse) {
        const reported = fields.usageState.serverToolUse;
        usage.server_tool_use = Object.fromEntries(
          Object.entries(serverToolUse).map(([key, value]) => [
            key,
            value - (reported?.[key] ?? 0),
          ])
        );
        fields.usageState.serverToolUse = { ...serverToolUse };
      }
      if ("cost" in data.usage && typeof data.usage.cost === "number") {
        usage.cost = data.usage.cost;
      }
      if (Object.keys(usage).length > 0) {
        output["usage"] = usage;
      }
      return output;
    });
    return {
      chunk: new AIMessageChunk({
        content: fields.coerceContentToString ? "" : [],
        response_metadata: responseMetadata,
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
      "tool_search_tool_result",
      "tool_search_tool_bm25_tool_result",
      "tool_search_tool_regex_tool_result",
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
        response_metadata,
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
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
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
            response_metadata,
          }),
        };
      }

      return {
        chunk: new AIMessageChunk({
          content: [{ index: data.index, ...contentBlock, type: "text" }],
          response_metadata,
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
        response_metadata,
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
          response_metadata,
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
        response_metadata,
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
        response_metadata,
      }),
    };
  } else if (
    data.type === "content_block_start" &&
    _isAnthropicCompactionBlock(data.content_block)
  ) {
    return {
      chunk: new AIMessageChunk({
        content: fields.coerceContentToString
          ? ""
          : [{ index: data.index, ...data.content_block }],
        response_metadata,
      }),
    };
  } else if (
    data.type === "content_block_delta" &&
    data.delta.type === "compaction_delta"
  ) {
    return {
      chunk: new AIMessageChunk({
        content: fields.coerceContentToString
          ? ""
          : [
              {
                index: data.index,
                ...data.delta,
                type: "compaction",
              },
            ],
        response_metadata,
      }),
    };
  }
  return null;
}

export function anthropicResponseToChatMessages(
  messages: AnthropicMessageResponse[],
  additionalKwargs: Record<string, unknown>
): ChatGeneration[] {
  const response_metadata = {
    ...additionalKwargs,
    model_provider: "anthropic",
  };
  const usage: Record<string, number> | null | undefined =
    additionalKwargs.usage as Record<string, number> | null | undefined;
  const usageMetadata = usage != null ? buildUsageMetadata(usage) : undefined;
  if (messages.length === 1 && messages[0].type === "text") {
    return [
      {
        text: messages[0].text,
        message: new AIMessage({
          content: messages[0].text,
          additional_kwargs: additionalKwargs,
          usage_metadata: usageMetadata,
          response_metadata,
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
          // oxlint-disable-next-line @typescript-eslint/no-explicit-any
          content: messages as any,
          additional_kwargs: additionalKwargs,
          tool_calls: toolCalls,
          usage_metadata: usageMetadata,
          response_metadata,
          id: additionalKwargs.id as string,
        }),
      },
    ];
    return generations;
  }
}

export function buildUsageMetadata(
  usage: Anthropic.Messages.Usage | Record<string, number>
): UsageMetadata {
  const cacheCreationInputTokens = usage.cache_creation_input_tokens ?? 0;
  const cacheReadInputTokens = usage.cache_read_input_tokens ?? 0;
  // Total input tokens in a Claude API request is the summation of `input_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens`.
  // ref: https://platform.claude.com/docs/en/api/messages
  const totalInputTokens =
    usage.input_tokens + cacheCreationInputTokens + cacheReadInputTokens;
  return {
    input_tokens: totalInputTokens,
    output_tokens: usage.output_tokens,
    total_tokens: totalInputTokens + usage.output_tokens,
    input_token_details: {
      cache_creation: cacheCreationInputTokens,
      cache_read: cacheReadInputTokens,
    },
  };
}
