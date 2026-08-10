import { describe, expect, test, vi } from "vitest";
import {
  ContextOverflowError,
  QuotaExceededError,
  ServerError,
  TimeoutError,
} from "@langchain/core/errors";

import { ChatFireworks } from "../chat_models.js";

function parentCompletionWithRetry(model: ChatFireworks) {
  return Object.getPrototypeOf(Object.getPrototypeOf(model)) as {
    completionWithRetry: (
      request: Record<string, unknown>,
      options?: unknown
    ) => Promise<unknown>;
  };
}

describe("ChatFireworks", () => {
  test("supports string model shorthand", () => {
    const model = new ChatFireworks(
      "accounts/fireworks/models/firefunction-v2",
      {
        apiKey: "test-api-key",
        temperature: 0.2,
      }
    );

    expect(model.model).toBe("accounts/fireworks/models/firefunction-v2");
    expect(model.temperature).toBe(0.2);
  });

  test("uses LangSmith Gateway environment configuration", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");
    vi.stubEnv("FIREWORKS_API_BASE", "");
    vi.stubEnv("FIREWORKS_BASE_URL", "");
    vi.stubEnv("FIREWORKS_API_KEY", "provider-key");
    try {
      const model = new ChatFireworks();

      expect(model.apiKey).toBe("gateway-key");
      expect(model.clientConfig.baseURL).toBe(
        "https://gateway.smith.langchain.com/fireworks"
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("prefers the Fireworks base URL environment configuration", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");
    vi.stubEnv("FIREWORKS_API_BASE", "");
    vi.stubEnv("FIREWORKS_BASE_URL", "https://fireworks.example.com/v1");
    vi.stubEnv("FIREWORKS_API_KEY", "provider-key");
    try {
      const model = new ChatFireworks();

      expect(model.apiKey).toBe("provider-key");
      expect(model.clientConfig.baseURL).toBe(
        "https://fireworks.example.com/v1"
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("serializes with Fireworks secret aliases", () => {
    const model = new ChatFireworks({
      apiKey: "test-api-key",
      model: "accounts/fireworks/models/firefunction-v2",
    });

    expect(JSON.stringify(model)).toContain(
      '"id":["langchain","chat_models","fireworks","ChatFireworks"]'
    );
    expect(JSON.stringify(model)).toContain('"FIREWORKS_API_KEY"');
    expect(JSON.stringify(model)).not.toContain("test-api-key");
  });

  test("completionWithRetry strips unsupported parameters", async () => {
    const model = new ChatFireworks({
      apiKey: "test-api-key",
    });

    const parentPrototype = Object.getPrototypeOf(
      Object.getPrototypeOf(model)
    ) as {
      completionWithRetry: (
        request: Record<string, unknown>,
        options?: unknown
      ) => Promise<unknown>;
    };

    const spy = vi
      .spyOn(parentPrototype, "completionWithRetry")
      .mockResolvedValue({} as never);

    await model.completionWithRetry({
      model: "accounts/fireworks/models/firefunction-v2",
      messages: [],
      stream: false,
      frequency_penalty: 1,
      presence_penalty: 1,
      logit_bias: { "1": 1 },
      functions: [],
    });

    const capturedRequest = spy.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;

    expect(capturedRequest?.frequency_penalty).toBeUndefined();
    expect(capturedRequest?.presence_penalty).toBeUndefined();
    expect(capturedRequest?.logit_bias).toBeUndefined();
    expect(capturedRequest?.functions).toBeUndefined();
  });

  test("wraps a 402 as non-retryable QuotaExceededError", async () => {
    const model = new ChatFireworks({ apiKey: "test-api-key" });
    vi.spyOn(
      parentCompletionWithRetry(model),
      "completionWithRetry"
    ).mockRejectedValue(
      Object.assign(new Error("payment required"), {
        status: 402,
      })
    );

    const error: QuotaExceededError = await model
      .completionWithRetry({
        model: "accounts/fireworks/models/firefunction-v2",
        messages: [],
        stream: false,
      })
      .catch((e) => e);

    expect(error).toBeInstanceOf(QuotaExceededError);
    expect(error.isRetryable).toBe(false);
  });

  test("wraps a 408 as retryable TimeoutError", async () => {
    const model = new ChatFireworks({ apiKey: "test-api-key" });
    vi.spyOn(
      parentCompletionWithRetry(model),
      "completionWithRetry"
    ).mockRejectedValue(
      Object.assign(new Error("request timeout"), {
        status: 408,
      })
    );

    const error: TimeoutError = await model
      .completionWithRetry({
        model: "accounts/fireworks/models/firefunction-v2",
        messages: [],
        stream: false,
      })
      .catch((e) => e);

    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.isRetryable).toBe(true);
  });

  test("wraps a 413 as non-retryable ContextOverflowError", async () => {
    const model = new ChatFireworks({ apiKey: "test-api-key" });
    vi.spyOn(
      parentCompletionWithRetry(model),
      "completionWithRetry"
    ).mockRejectedValue(
      Object.assign(new Error("payload too large"), {
        status: 413,
      })
    );

    const error: ContextOverflowError = await model
      .completionWithRetry({
        model: "accounts/fireworks/models/firefunction-v2",
        messages: [],
        stream: false,
      })
      .catch((e) => e);

    expect(error).toBeInstanceOf(ContextOverflowError);
    expect(error.statusCode).toBe(413);
    expect(error.isRetryable).toBe(false);
  });

  test("leaves an already-classified error from wrapOpenAIClientError unchanged", async () => {
    const model = new ChatFireworks({ apiKey: "test-api-key" });
    const alreadyClassified = new ServerError("boom", { statusCode: 500 });
    vi.spyOn(
      parentCompletionWithRetry(model),
      "completionWithRetry"
    ).mockRejectedValue(alreadyClassified);

    const error = await model
      .completionWithRetry({
        model: "accounts/fireworks/models/firefunction-v2",
        messages: [],
        stream: false,
      })
      .catch((e) => e);

    expect(error).toBe(alreadyClassified);
  });
});
