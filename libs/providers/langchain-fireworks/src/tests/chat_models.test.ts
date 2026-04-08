import { describe, expect, test, vi } from "vitest";

import { ChatFireworks } from "../chat_models.js";

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
});
