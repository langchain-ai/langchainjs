import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOpenAI } from "@langchain/openai";

import { initChatModel } from "../universal.js";

const LANGSMITH_ENVIRONMENT_VARIABLES = [
  "LANGSMITH_GATEWAY",
  "LANGSMITH_GATEWAY_API_KEY",
  "LANGSMITH_API_KEY",
];

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

describe("initChatModel LangSmith provider", () => {
  beforeEach(() => {
    for (const name of LANGSMITH_ENVIRONMENT_VARIABLES) {
      vi.stubEnv(name, "");
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the default gateway and gateway API key", async () => {
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");
    vi.stubEnv("LANGSMITH_API_KEY", "langsmith-key");

    const model = await initChatModel("langsmith:moonshotai/kimi-k3");
    const chat = (await model._getModelInstance()) as ChatOpenAI;

    expect(chat.model).toBe("moonshotai/kimi-k3");
    expect(chat.clientConfig.baseURL).toBe(
      "https://gateway.smith.langchain.com/v1"
    );
    expect(chat.apiKey).toBe("gateway-key");
    expect(chat.useResponsesApi).toBe(true);
  });

  it("falls back to the LangSmith API key", async () => {
    vi.stubEnv("LANGSMITH_API_KEY", "langsmith-key");

    const model = await initChatModel("langsmith:moonshotai/kimi-k3");
    const chat = (await model._getModelInstance()) as ChatOpenAI;

    expect(chat.apiKey).toBe("langsmith-key");
  });

  it("uses a custom gateway URL and always enables the Responses API", async () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "https://eu.gateway.example.com/");
    vi.stubEnv("LANGSMITH_API_KEY", "langsmith-key");

    const model = await initChatModel("moonshotai/kimi-k3", {
      modelProvider: "langsmith",
      useResponsesApi: false,
    });
    const chat = (await model._getModelInstance()) as ChatOpenAI;

    expect(chat.clientConfig.baseURL).toBe("https://eu.gateway.example.com/v1");
    expect(chat.apiKey).toBe("langsmith-key");
    expect(chat.useResponsesApi).toBe(true);
  });

  it("preserves explicit gateway configuration", async () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "https://eu.gateway.example.com");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");

    const model = await initChatModel("langsmith:moonshotai/kimi-k3", {
      apiKey: "explicit-key",
      configuration: {
        baseURL: "https://apac.gateway.example.com/v1",
      },
    });
    const chat = (await model._getModelInstance()) as ChatOpenAI;

    expect(chat.clientConfig.baseURL).toBe(
      "https://apac.gateway.example.com/v1"
    );
    expect(chat.apiKey).toBe("explicit-key");
  });
});
