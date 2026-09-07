import { describe, expect, test } from "vitest";
import type * as Bedrock from "@aws-sdk/client-bedrock-runtime";
import { concat } from "@langchain/core/utils/stream";
import {
  convertConverseMessageToLangChainMessage,
  handleConverseStreamContentBlockDelta,
  handleConverseStreamMetadata,
} from "../message_outputs.js";

describe("reasoning output conversion", () => {
  test("uses standard reasoning content by default", () => {
    const result = convertConverseMessageToLangChainMessage(
      {
        role: "assistant",
        content: [
          {
            reasoningContent: {
              reasoningText: {
                text: "Reasoning summary",
                signature: "opaque-signature",
              },
            },
          },
        ],
      },
      {
        stopReason: "end_turn",
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        metrics: { latencyMs: 0 },
      }
    );

    expect(result.content).toEqual([
      {
        type: "reasoning",
        reasoning: "Reasoning summary",
        signature: "opaque-signature",
      },
    ]);
    expect(result.response_metadata).not.toHaveProperty("output_version");
  });

  test("merges streaming reasoning and signature into a standard block", () => {
    const reasoning = handleConverseStreamContentBlockDelta({
      contentBlockIndex: 0,
      delta: { reasoningContent: { text: "Reasoning summary" } },
    });
    const signature = handleConverseStreamContentBlockDelta({
      contentBlockIndex: 0,
      delta: { reasoningContent: { signature: "opaque-signature" } },
    });

    const result = concat(reasoning.message, signature.message);

    expect(result.content).toEqual([
      {
        type: "reasoning",
        reasoning: "Reasoning summary",
        signature: "opaque-signature",
        index: 0,
      },
    ]);
    expect(result.response_metadata).not.toHaveProperty("output_version");
  });
});

describe("message output usage metadata conversion", () => {
  test("maps Bedrock prompt cache tokens for non-stream responses", () => {
    const message: Bedrock.Message = {
      role: "assistant",
      content: [{ text: "Hello" }],
    };
    const responseMetadata = {
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 25,
        cacheReadInputTokens: 7,
        cacheWriteInputTokens: 3,
      },
    } as Omit<Bedrock.ConverseResponse, "output">;

    const result = convertConverseMessageToLangChainMessage(
      message,
      responseMetadata
    );

    expect(result.usage_metadata).toEqual({
      input_tokens: 20,
      output_tokens: 5,
      total_tokens: 25,
      input_token_details: {
        cache_read: 7,
        cache_creation: 3,
      },
    });
  });

  test("does not add input_token_details when Bedrock cache fields are absent", () => {
    const message: Bedrock.Message = {
      role: "assistant",
      content: [{ text: "Hello" }],
    };
    const responseMetadata = {
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      },
    } as Omit<Bedrock.ConverseResponse, "output">;

    const result = convertConverseMessageToLangChainMessage(
      message,
      responseMetadata
    );

    expect(result.usage_metadata?.input_token_details).toBeUndefined();
  });

  test("maps Bedrock prompt cache tokens for stream metadata", () => {
    const result = handleConverseStreamMetadata(
      {
        usage: {
          inputTokens: 20,
          outputTokens: 4,
          totalTokens: 39,
          cacheReadInputTokens: 9,
          cacheWriteInputTokens: 6,
        },
      },
      { streamUsage: true }
    );

    expect(result.message.usage_metadata).toEqual({
      input_tokens: 35,
      output_tokens: 4,
      total_tokens: 39,
      input_token_details: {
        cache_read: 9,
        cache_creation: 6,
      },
    });
  });
});
