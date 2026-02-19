import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ChatOpenRouter } from "../index.js";
import { OpenRouterAuthError } from "../../utils/errors.js";

let savedKey: string | undefined;

beforeAll(() => {
  savedKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
});

afterAll(() => {
  if (savedKey !== undefined) {
    process.env.OPENROUTER_API_KEY = savedKey;
  } else {
    delete process.env.OPENROUTER_API_KEY;
  }
});

// ─── Constructor ─────────────────────────────────────────────────────

describe("ChatOpenRouter constructor", () => {
  it("assigns all fields from params", () => {
    const model = new ChatOpenRouter({
      model: "anthropic/claude-4-sonnet",
      apiKey: "sk-test",
      temperature: 0.5,
      maxTokens: 1024,
      topP: 0.9,
      topK: 40,
      frequencyPenalty: 0.1,
      presencePenalty: 0.2,
      repetitionPenalty: 1.1,
      minP: 0.05,
      topA: 0.3,
      seed: 42,
      stop: ["\n"],
      logitBias: { "50256": -100 },
      topLogprobs: 3,
      user: "user-123",
      transforms: ["middle-out"],
      models: ["a", "b"],
      route: "fallback",
      siteUrl: "https://example.com",
      siteName: "TestApp",
      streamUsage: false,
    });

    expect(model.model).toBe("anthropic/claude-4-sonnet");
    expect(model.apiKey).toBe("sk-test");
    expect(model.temperature).toBe(0.5);
    expect(model.maxTokens).toBe(1024);
    expect(model.topP).toBe(0.9);
    expect(model.topK).toBe(40);
    expect(model.frequencyPenalty).toBe(0.1);
    expect(model.presencePenalty).toBe(0.2);
    expect(model.repetitionPenalty).toBe(1.1);
    expect(model.minP).toBe(0.05);
    expect(model.topA).toBe(0.3);
    expect(model.seed).toBe(42);
    expect(model.stop).toEqual(["\n"]);
    expect(model.logitBias).toEqual({ "50256": -100 });
    expect(model.topLogprobs).toBe(3);
    expect(model.user).toBe("user-123");
    expect(model.transforms).toEqual(["middle-out"]);
    expect(model.models).toEqual(["a", "b"]);
    expect(model.route).toBe("fallback");
    expect(model.siteUrl).toBe("https://example.com");
    expect(model.siteName).toBe("TestApp");
    expect(model.streamUsage).toBe(false);
  });

  it("defaults baseURL and streamUsage", () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o" });
    expect(model.baseURL).toBe("https://openrouter.ai/api/v1");
    expect(model.streamUsage).toBe(true);
  });

  it("throws OpenRouterAuthError when no API key is available", () => {
    const original = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      expect(() => new ChatOpenRouter({ model: "openai/gpt-4o" })).toThrow();
      try {
        new ChatOpenRouter({ model: "openai/gpt-4o" });
      } catch (e) {
        expect(OpenRouterAuthError.isInstance(e)).toBe(true);
      }
    } finally {
      process.env.OPENROUTER_API_KEY = original;
    }
  });
});

// ─── invocationParams ────────────────────────────────────────────────

describe("invocationParams", () => {
  it("call-time options override constructor defaults", () => {
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o",
      temperature: 0.7,
      maxTokens: 500,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params = model.invocationParams({
      temperature: 0.2,
      maxTokens: 100,
    } as any);

    expect(params.temperature).toBe(0.2);
    expect(params.max_tokens).toBe(100);
  });

  it("falls back to constructor values when call options are absent", () => {
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o",
      temperature: 0.7,
      topK: 50,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params = model.invocationParams({} as any);

    expect(params.temperature).toBe(0.7);
    expect(params.top_k).toBe(50);
  });

  it("passes through OpenRouter-specific fields", () => {
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o",
      transforms: ["middle-out"],
      models: ["a", "b"],
      route: "fallback",
      provider: { order: ["OpenAI"] },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params = model.invocationParams({} as any);

    expect(params.transforms).toEqual(["middle-out"]);
    expect(params.models).toEqual(["a", "b"]);
    expect(params.route).toBe("fallback");
    expect(params.provider).toEqual({ order: ["OpenAI"] });
  });

  it("includes prediction only when set", () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withoutPrediction = model.invocationParams({} as any);
    expect(withoutPrediction).not.toHaveProperty("prediction");

    const withPrediction = model.invocationParams({
      prediction: { type: "content", content: "hello" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(withPrediction.prediction).toEqual({
      type: "content",
      content: "hello",
    });
  });
});

// ─── getLsParams ─────────────────────────────────────────────────────

describe("getLsParams", () => {
  it("returns correct LangSmith metadata", () => {
    const model = new ChatOpenRouter({
      model: "anthropic/claude-4-sonnet",
      temperature: 0.3,
      maxTokens: 256,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ls = model.getLsParams({ stop: ["END"] } as any);

    expect(ls.ls_provider).toBe("openrouter");
    expect(ls.ls_model_name).toBe("anthropic/claude-4-sonnet");
    expect(ls.ls_model_type).toBe("chat");
    expect(ls.ls_temperature).toBe(0.3);
    expect(ls.ls_max_tokens).toBe(256);
    expect(ls.ls_stop).toEqual(["END"]);
  });
});
