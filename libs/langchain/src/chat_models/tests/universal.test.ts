import { afterEach, describe, it, expect, vi } from "vitest";
import { ChatOpenAI } from "@langchain/openai";
import {
  getChatModelByClassName,
  initChatModel,
  registerProviderForBundling,
} from "../universal.js";

describe("Will appropriately infer a model profiles", () => {
  it("when provided a profile", async () => {
    const model = await initChatModel("gpt-4o-mini", {
      profile: {
        maxInputTokens: 100000,
      },
    });
    expect(model.profile.maxInputTokens).toBe(100000);
  });

  it("when it should be inferred from the model instance", async () => {
    const model = await initChatModel("gpt-4o-mini", {
      temperature: 0,
    });
    expect(model.profile.maxInputTokens).toBeDefined();
  });
});

describe("registerProviderForBundling", () => {
  afterEach(() => {
    globalThis.lc_chat_model_provider_registry.clear();
  });

  it("returns the registered class for the given provider", async () => {
    class DummyOpenAI {
      constructor(public fields: Record<string, unknown>) {}
    }

    registerProviderForBundling("openai", { ChatOpenAI: DummyOpenAI });

    const chatModelClass = await getChatModelByClassName(
      "ChatOpenAI",
      "openai"
    );

    expect(chatModelClass).toBe(DummyOpenAI);
  });

  it("falls through to dynamic import when no registration exists", async () => {
    // No registerProviderForBundling call. Must hit the dynamic-import branch
    // and resolve the real class from @langchain/openai.
    const chatModelClass = await getChatModelByClassName(
      "ChatOpenAI",
      "openai"
    );

    expect(chatModelClass).toBe(ChatOpenAI);
  });

  it("overwrites a prior registration for the same provider key", async () => {
    class DummyOpenAI {
      constructor(public fields: Record<string, unknown>) {}
    }

    class AnotherDummyOpenAI {
      constructor(public fields: Record<string, unknown>) {}
    }

    registerProviderForBundling("openai", { ChatOpenAI: DummyOpenAI });
    registerProviderForBundling("openai", {
      ChatOpenAI: AnotherDummyOpenAI,
    });

    const chatModelClass = await getChatModelByClassName(
      "ChatOpenAI",
      "openai"
    );

    expect(chatModelClass).toBe(AnotherDummyOpenAI);
  });

  it("throws when the registered module is missing the expected class", async () => {
    registerProviderForBundling("openai", {});

    await expect(
      getChatModelByClassName("ChatOpenAI", "openai")
    ).rejects.toThrow(
      `Module registered for "openai" must export "ChatOpenAI".`
    );
  });

  it("initChatModel uses the registered class", async () => {
    const constructorSpy = vi.fn();
    class TrackedDummyOpenAI {
      constructor(public fields: Record<string, unknown>) {
        constructorSpy(fields);
      }
    }
    registerProviderForBundling("openai", {
      ChatOpenAI: TrackedDummyOpenAI,
    });

    await initChatModel("openai:gpt-4o-mini", { temperature: 0.5 });

    expect(constructorSpy).toHaveBeenCalledOnce();
    expect(constructorSpy).toHaveBeenCalledWith({
      model: "gpt-4o-mini",
      temperature: 0.5,
    });
  });
});
