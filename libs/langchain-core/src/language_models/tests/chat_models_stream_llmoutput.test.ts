import { describe, test, expect } from "vitest";
import { BaseChatModel } from "../chat_models.js";
import { AIMessageChunk } from "../../messages/ai.js";
import { ChatGenerationChunk } from "../../outputs.js";
import type { ChatResult, LLMResult } from "../../outputs.js";
import type { UsageMetadata } from "../../messages/metadata.js";

type Delta = { text: string; usage?: UsageMetadata };

/** Minimal streaming model that emits a caller-supplied usage shape. */
class UsageStreamingChatModel extends BaseChatModel {
  constructor(private readonly deltas: Delta[]) {
    super({});
  }

  _llmType() {
    return "usage-streaming-fake";
  }

  async _generate(): Promise<ChatResult> {
    throw new Error("not used by these tests");
  }

  async *_streamResponseChunks(): AsyncGenerator<ChatGenerationChunk> {
    for (const delta of this.deltas) {
      yield new ChatGenerationChunk({
        text: delta.text,
        message: new AIMessageChunk({
          content: delta.text,
          usage_metadata: delta.usage,
        }),
      });
    }
  }
}

async function llmOutputFromStream(deltas: Delta[]) {
  let captured: LLMResult["llmOutput"];
  const model = new UsageStreamingChatModel(deltas);
  const stream = await model.stream("hi", {
    callbacks: [
      {
        handleLLMEnd(output: LLMResult) {
          captured = output.llmOutput;
        },
      },
    ],
  });
  for await (const _ of stream) {
    // drain
  }
  return captured;
}

describe("streaming llmOutput token usage", () => {
  test("sums per-chunk deltas rather than keeping the last chunk", async () => {
    const llmOutput = await llmOutputFromStream([
      {
        text: "a",
        usage: { input_tokens: 10, output_tokens: 1, total_tokens: 11 },
      },
      {
        text: "b",
        usage: { input_tokens: 0, output_tokens: 2, total_tokens: 2 },
      },
      {
        text: "c",
        usage: { input_tokens: 0, output_tokens: 3, total_tokens: 3 },
      },
    ]);

    // Keeping only the final chunk would report 0 / 3 / 3.
    expect(llmOutput?.tokenUsage).toEqual({
      promptTokens: 10,
      completionTokens: 6,
      totalTokens: 16,
    });
  });

  test("still reports totals from providers that only send usage on the last chunk", async () => {
    const llmOutput = await llmOutputFromStream([
      { text: "a" },
      { text: "b" },
      {
        text: "c",
        usage: { input_tokens: 10, output_tokens: 6, total_tokens: 16 },
      },
    ]);

    expect(llmOutput?.tokenUsage).toEqual({
      promptTokens: 10,
      completionTokens: 6,
      totalTokens: 16,
    });
  });

  test("agrees with the concatenated message usage_metadata", async () => {
    const deltas: Delta[] = [
      {
        text: "a",
        usage: { input_tokens: 41, output_tokens: 100, total_tokens: 141 },
      },
      {
        text: "b",
        usage: { input_tokens: 0, output_tokens: 150, total_tokens: 150 },
      },
      {
        text: "c",
        usage: { input_tokens: 0, output_tokens: 167, total_tokens: 167 },
      },
    ];
    const llmOutput = await llmOutputFromStream(deltas);

    const model = new UsageStreamingChatModel(deltas);
    const stream = await model.stream("hi");
    let merged: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      merged = merged ? merged.concat(chunk) : chunk;
    }

    expect(llmOutput?.tokenUsage).toEqual({
      promptTokens: merged?.usage_metadata?.input_tokens,
      completionTokens: merged?.usage_metadata?.output_tokens,
      totalTokens: merged?.usage_metadata?.total_tokens,
    });
  });
});
