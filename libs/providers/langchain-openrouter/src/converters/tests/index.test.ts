import { describe, it, expect } from "vitest";
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
