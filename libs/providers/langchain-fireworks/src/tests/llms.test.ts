import { describe, expect, test, vi } from "vitest";

import { Fireworks } from "../llms.js";

describe("Fireworks LLM", () => {
  test("supports string model shorthand", () => {
    const model = new Fireworks("accounts/fireworks/models/llama-v2-13b", {
      apiKey: "test-api-key",
      temperature: 0.1,
    });

    expect(model.model).toBe("accounts/fireworks/models/llama-v2-13b");
    expect(model.temperature).toBe(0.1);
  });

  test("serializes with Fireworks secret aliases", () => {
    const model = new Fireworks({
      apiKey: "test-api-key",
      model: "accounts/fireworks/models/llama-v2-13b",
    });

    expect(JSON.stringify(model)).toContain('"id":["langchain","llms","fireworks","Fireworks"]');
    expect(JSON.stringify(model)).toContain('"FIREWORKS_API_KEY"');
    expect(JSON.stringify(model)).not.toContain("test-api-key");
  });

  test("completionWithRetry normalizes single-element prompt arrays", async () => {
    const model = new Fireworks({
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
      model: "accounts/fireworks/models/llama-v2-13b",
      prompt: ["hello"],
      stream: false,
      frequency_penalty: 1,
      presence_penalty: 1,
      best_of: 2,
      logit_bias: { "1": 1 },
    });

    const capturedRequest = spy.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;

    expect(capturedRequest?.prompt).toBe("hello");
    expect(capturedRequest?.frequency_penalty).toBeUndefined();
    expect(capturedRequest?.presence_penalty).toBeUndefined();
    expect(capturedRequest?.best_of).toBeUndefined();
    expect(capturedRequest?.logit_bias).toBeUndefined();
  });

  test("rejects multiple prompts", async () => {
    const model = new Fireworks({
      apiKey: "test-api-key",
    });

    await expect(
      model.completionWithRetry({
        model: "accounts/fireworks/models/llama-v2-13b",
        prompt: ["hello", "world"],
        stream: false,
      })
    ).rejects.toThrow("Multiple prompts are not supported by Fireworks");
  });
});
