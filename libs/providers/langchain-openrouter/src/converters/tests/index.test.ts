import { describe, it, expect } from "vitest";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { formatToolChoice } from "../tools.js";
import {
  convertUsageMetadata,
  convertOpenRouterResponseToBaseMessage,
  convertOpenRouterDeltaToBaseMessageChunk,
} from "../messages.js";
import type { OpenRouter } from "../../api-types.js";

// ─── formatToolChoice ────────────────────────────────────────────────

describe("formatToolChoice", () => {
  it("returns undefined for undefined", () => {
    expect(formatToolChoice(undefined)).toBeUndefined();
  });

  it('maps "auto" to "auto"', () => {
    expect(formatToolChoice("auto")).toBe("auto");
  });

  it('maps "none" to "none"', () => {
    expect(formatToolChoice("none")).toBe("none");
  });

  it('maps "any" to "required"', () => {
    expect(formatToolChoice("any")).toBe("required");
  });

  it('maps "required" to "required"', () => {
    expect(formatToolChoice("required")).toBe("required");
  });

  it("wraps a named tool string in function format", () => {
    expect(formatToolChoice("get_weather")).toEqual({
      type: "function",
      function: { name: "get_weather" },
    });
  });

  it("passes an object through unchanged", () => {
    const obj = { type: "function", function: { name: "foo" } };
    expect(formatToolChoice(obj)).toEqual(obj);
  });
});

// ─── convertUsageMetadata ────────────────────────────────────────────

describe("convertUsageMetadata", () => {
  it("returns undefined when usage is undefined", () => {
    expect(convertUsageMetadata(undefined)).toBeUndefined();
  });

  it("maps basic token counts", () => {
    const usage: OpenRouter.ChatGenerationTokenUsage = {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    };
    expect(convertUsageMetadata(usage)).toEqual({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
    });
  });

  it("maps full token details", () => {
    const usage: OpenRouter.ChatGenerationTokenUsage = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      prompt_tokens_details: { cached_tokens: 80, audio_tokens: 5 },
      completion_tokens_details: { reasoning_tokens: 10 },
    };
    expect(convertUsageMetadata(usage)).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      input_token_details: { cache_read: 80, audio: 5 },
      output_token_details: { reasoning: 10 },
    });
  });

  it("omits detail sub-objects when all detail fields are null", () => {
    const usage: OpenRouter.ChatGenerationTokenUsage = {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
      prompt_tokens_details: {},
      completion_tokens_details: {},
    };
    const result = convertUsageMetadata(usage);
    expect(result?.input_token_details).toBeUndefined();
    expect(result?.output_token_details).toBeUndefined();
  });
});

// ─── Response metadata smoke tests ──────────────────────────────────

describe("convertOpenRouterResponseToBaseMessage metadata", () => {
  it("patches response_metadata with openrouter fields", () => {
    const choice: OpenRouter.ChatResponseChoice = {
      index: 0,
      finish_reason: "stop",
      message: { role: "assistant", content: "hello" },
    };
    const rawResponse: OpenRouter.ChatResponse = {
      id: "gen-123",
      choices: [choice],
      created: 0,
      model: "anthropic/claude-4-sonnet",
      object: "chat.completion",
    };

    const msg = convertOpenRouterResponseToBaseMessage(choice, rawResponse);

    const meta = msg.response_metadata as Record<string, unknown>;
    expect(meta.model).toBe("anthropic/claude-4-sonnet");
    expect(meta.model_provider).toBe("openrouter");
    expect(meta.model_name).toBe("anthropic/claude-4-sonnet");
    expect(meta.finish_reason).toBe("stop");
  });
});

describe("convertOpenRouterDeltaToBaseMessageChunk metadata", () => {
  it("patches response_metadata with model_provider", () => {
    const delta: OpenRouter.ChatStreamingMessageChunk = {
      role: "assistant",
      content: "hi",
    };
    const rawChunk = {
      id: "gen-456",
      choices: [{ delta, finish_reason: null, index: 0 }],
      created: 0,
      model: "openai/gpt-4o",
      object: "chat.completion.chunk" as const,
    };

    const chunk = convertOpenRouterDeltaToBaseMessageChunk(
      delta,
      rawChunk,
      "assistant"
    );

    const meta = chunk.response_metadata as Record<string, unknown>;
    expect(meta.model_provider).toBe("openrouter");
  });
});

// ─── reasoning extraction ────────────────────────────────────────────

describe("convertOpenRouterResponseToBaseMessage reasoning", () => {
  it("copies message.reasoning into additional_kwargs.reasoning_content", () => {
    const choice: OpenRouter.ChatResponseChoice = {
      index: 0,
      finish_reason: "stop",
      message: {
        role: "assistant",
        content: "The answer is 42.",
        reasoning: "Let me think... 6 * 7 = 42.",
      },
    };
    const rawResponse: OpenRouter.ChatResponse = {
      id: "gen-r1",
      choices: [choice],
      created: 0,
      model: "deepseek/deepseek-reasoner",
      object: "chat.completion",
    };

    const msg = convertOpenRouterResponseToBaseMessage(choice, rawResponse);

    expect(msg.additional_kwargs.reasoning_content).toBe(
      "Let me think... 6 * 7 = 42."
    );
    // And through contentBlocks, it becomes a v1 reasoning block.
    const blocks = (msg as AIMessage).contentBlocks;
    expect(blocks).toContainEqual({
      type: "reasoning",
      reasoning: "Let me think... 6 * 7 = 42.",
    });
    expect(blocks).toContainEqual({
      type: "text",
      text: "The answer is 42.",
    });
  });

  it("copies message.reasoning_details into additional_kwargs.reasoning_details", () => {
    const choice: OpenRouter.ChatResponseChoice = {
      index: 0,
      finish_reason: "stop",
      message: {
        role: "assistant",
        content: "Done.",
        reasoning_details: [
          {
            type: "reasoning.text",
            text: "Step 1, step 2, step 3.",
            signature: "sig_abc",
          },
        ],
      },
    };
    const rawResponse: OpenRouter.ChatResponse = {
      id: "gen-r2",
      choices: [choice],
      created: 0,
      model: "anthropic/claude-3.7-sonnet",
      object: "chat.completion",
    };

    const msg = convertOpenRouterResponseToBaseMessage(choice, rawResponse);

    expect(msg.additional_kwargs.reasoning_details).toEqual([
      {
        type: "reasoning.text",
        text: "Step 1, step 2, step 3.",
        signature: "sig_abc",
      },
    ]);
    const blocks = (msg as AIMessage).contentBlocks;
    expect(blocks).toContainEqual({
      type: "reasoning",
      reasoning: "Step 1, step 2, step 3.",
    });
  });

  it("omits reasoning fields when the response has none", () => {
    const choice: OpenRouter.ChatResponseChoice = {
      index: 0,
      finish_reason: "stop",
      message: { role: "assistant", content: "plain reply" },
    };
    const rawResponse: OpenRouter.ChatResponse = {
      id: "gen-plain",
      choices: [choice],
      created: 0,
      model: "openai/gpt-4o-mini",
      object: "chat.completion",
    };

    const msg = convertOpenRouterResponseToBaseMessage(choice, rawResponse);

    expect(msg.additional_kwargs.reasoning_content).toBeUndefined();
    expect(msg.additional_kwargs.reasoning_details).toBeUndefined();
  });
});

describe("convertOpenRouterDeltaToBaseMessageChunk reasoning", () => {
  const rawChunk = (delta: OpenRouter.ChatStreamingMessageChunk) => ({
    id: "gen-r-stream",
    choices: [{ delta, finish_reason: null, index: 0 }],
    created: 0,
    model: "deepseek/deepseek-reasoner",
    object: "chat.completion.chunk" as const,
  });

  it("copies delta.reasoning into additional_kwargs.reasoning_content", () => {
    const delta: OpenRouter.ChatStreamingMessageChunk = {
      role: "assistant",
      reasoning: "first thought ",
    };

    const chunk = convertOpenRouterDeltaToBaseMessageChunk(
      delta,
      rawChunk(delta),
      "assistant"
    );

    expect(chunk.additional_kwargs.reasoning_content).toBe("first thought ");
  });

  it("concatenates reasoning across streaming chunks via chunk merge", () => {
    const d1: OpenRouter.ChatStreamingMessageChunk = {
      role: "assistant",
      reasoning: "Let me ",
    };
    const d2: OpenRouter.ChatStreamingMessageChunk = { reasoning: "think " };
    const d3: OpenRouter.ChatStreamingMessageChunk = {
      content: "42.",
      reasoning: "carefully.",
    };

    const c1 = convertOpenRouterDeltaToBaseMessageChunk(
      d1,
      rawChunk(d1),
      "assistant"
    ) as AIMessageChunk;
    const c2 = convertOpenRouterDeltaToBaseMessageChunk(
      d2,
      rawChunk(d2),
      "assistant"
    ) as AIMessageChunk;
    const c3 = convertOpenRouterDeltaToBaseMessageChunk(
      d3,
      rawChunk(d3),
      "assistant"
    ) as AIMessageChunk;

    const merged = c1.concat(c2).concat(c3);

    expect(merged.additional_kwargs.reasoning_content).toBe(
      "Let me think carefully."
    );
    expect(merged.contentBlocks).toContainEqual({
      type: "reasoning",
      reasoning: "Let me think carefully.",
    });
    expect(merged.contentBlocks).toContainEqual({
      type: "text",
      text: "42.",
    });
  });

  it("omits reasoning fields when the delta has none", () => {
    const delta: OpenRouter.ChatStreamingMessageChunk = {
      role: "assistant",
      content: "hi",
    };

    const chunk = convertOpenRouterDeltaToBaseMessageChunk(
      delta,
      rawChunk(delta),
      "assistant"
    );

    expect(chunk.additional_kwargs.reasoning_content).toBeUndefined();
    expect(chunk.additional_kwargs.reasoning_details).toBeUndefined();
  });
});
