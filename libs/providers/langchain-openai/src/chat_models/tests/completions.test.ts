import { describe, it, expect, vi } from "vitest";
import { HumanMessage, AIMessageChunk } from "@langchain/core/messages";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { ChatOpenAICompletions } from "../completions.js";

describe("ChatOpenAICompletions constructor", () => {
  it("supports string model shorthand", () => {
    const model = new ChatOpenAICompletions("gpt-4o-mini", {
      temperature: 0.1,
    });
    expect(model.model).toBe("gpt-4o-mini");
    expect(model.temperature).toBe(0.1);
  });
});

describe("ChatOpenAICompletions streaming usage_metadata callback", () => {
  it("should call handleLLMNewToken for the usage chunk", async () => {
    const model = new ChatOpenAICompletions({
      model: "gpt-4o-mini",
      apiKey: "test-key",
      streaming: true,
      streamUsage: true,
    });

    // Mock completionWithRetry to return a fake async iterable
    // that simulates: one content chunk, then a usage-only chunk
    const fakeStream = (async function* () {
      // Content chunk
      yield {
        choices: [
          {
            index: 0,
            delta: { role: "assistant" as const, content: "Hello" },
            finish_reason: null,
            logprobs: null,
          },
        ],
        usage: null,
        system_fingerprint: null,
        model: "gpt-4o-mini",
        service_tier: null,
      };
      // Final chunk with finish_reason
      yield {
        choices: [
          {
            index: 0,
            delta: { content: "" },
            finish_reason: "stop",
            logprobs: null,
          },
        ],
        usage: null,
        system_fingerprint: "fp_abc123",
        model: "gpt-4o-mini",
        service_tier: null,
      };
      // Usage-only chunk (no choices)
      yield {
        choices: [],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          prompt_tokens_details: null,
          completion_tokens_details: null,
        },
        system_fingerprint: null,
        model: "gpt-4o-mini",
        service_tier: null,
      };
    })();

    model.completionWithRetry = vi
      .fn()
      .mockResolvedValue(fakeStream) as typeof model.completionWithRetry;

    // Create a mock runManager
    const handleLLMNewToken = vi.fn();
    const runManager = {
      handleLLMNewToken,
    } as unknown as CallbackManagerForLLMRun;

    const chunks = [];
    for await (const chunk of model._streamResponseChunks(
      [new HumanMessage("test")],
      {},
      runManager
    )) {
      chunks.push(chunk);
    }

    // Should have 3 chunks: content, finish, and usage
    expect(chunks.length).toBe(3);

    // The last chunk should have usage_metadata
    const usageChunk = chunks[chunks.length - 1];
    const usageMessage = usageChunk.message as AIMessageChunk;
    expect(usageMessage.usage_metadata).toBeDefined();
    expect(usageMessage.usage_metadata?.input_tokens).toBe(10);
    expect(usageMessage.usage_metadata?.output_tokens).toBe(5);
    expect(usageMessage.usage_metadata?.total_tokens).toBe(15);

    // handleLLMNewToken should have been called for EVERY chunk,
    // including the usage chunk (this is the bug fix)
    expect(handleLLMNewToken).toHaveBeenCalledTimes(3);

    // Verify the last call includes the usage chunk
    const lastCall = handleLLMNewToken.mock.calls[2];
    const lastCallFields = lastCall[5] as {
      chunk: { message: AIMessageChunk };
    };
    expect(lastCallFields.chunk.message.usage_metadata).toBeDefined();
    expect(lastCallFields.chunk.message.usage_metadata?.input_tokens).toBe(10);
  });
});

describe("ChatOpenAICompletions reasoning_content compatibility", () => {
  it("should preserve reasoning_content on streamed assistant chunks", async () => {
    const model = new ChatOpenAICompletions({
      model: "gpt-5.4",
      apiKey: "test-key",
      streaming: true,
    });

    const fakeStream = (async function* () {
      yield {
        choices: [
          {
            index: 0,
            delta: {
              role: "assistant" as const,
              content: "",
              reasoning_content: "The user",
            },
            finish_reason: null,
            logprobs: null,
          },
        ],
        usage: null,
        system_fingerprint: null,
        model: "gpt-5.4",
        service_tier: null,
      };
      yield {
        choices: [
          {
            index: 0,
            delta: { content: "" },
            finish_reason: "stop",
            logprobs: null,
          },
        ],
        usage: null,
        system_fingerprint: null,
        model: "gpt-5.4",
        service_tier: null,
      };
    })();

    model.completionWithRetry = vi
      .fn()
      .mockResolvedValue(fakeStream) as typeof model.completionWithRetry;

    const chunks = [];
    for await (const chunk of model._streamResponseChunks(
      [new HumanMessage("1+1=?")],
      {}
    )) {
      chunks.push(chunk);
    }

    const firstChunk = chunks[0].message as AIMessageChunk;
    expect(firstChunk.additional_kwargs.reasoning_content).toBe("The user");
  });
});
