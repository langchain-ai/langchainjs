import { describe, expect, test, vi } from "vitest";
import { ChatOpenAICompletions } from "@langchain/openai";
import { ChatTogetherAI } from "../chat_models.js";

describe("ChatTogetherAI", () => {
  test("defaults the model and uses apiKey", () => {
    const model = new ChatTogetherAI({ apiKey: "test-api-key" });

    expect(model.model).toBe("mistralai/Mixtral-8x7B-Instruct-v0.1");
    expect(model.getLsParams({})).toMatchObject({ ls_provider: "together" });
  });

  test("accepts togetherAIApiKey alias", () => {
    const model = new ChatTogetherAI({ togetherAIApiKey: "test-api-key" });

    expect(model.lc_secrets).toMatchObject({
      togetherAIApiKey: "TOGETHER_AI_API_KEY",
      apiKey: "TOGETHER_AI_API_KEY",
    });
  });

  test("throws when no api key is configured", () => {
    const current = process.env.TOGETHER_AI_API_KEY;
    delete process.env.TOGETHER_AI_API_KEY;

    try {
      expect(() => new ChatTogetherAI()).toThrow(
        /Together AI API key not found/
      );
    } finally {
      if (current === undefined) {
        delete process.env.TOGETHER_AI_API_KEY;
      } else {
        process.env.TOGETHER_AI_API_KEY = current;
      }
    }
  });

  test("strips unsupported request arguments before delegating", async () => {
    const spy = vi
      .spyOn(ChatOpenAICompletions.prototype, "completionWithRetry")
      .mockResolvedValue({} as never);
    const model = new ChatTogetherAI({ apiKey: "test-api-key" });
    const request = {
      model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      messages: [],
      stream: false,
      frequency_penalty: 1,
      presence_penalty: 1,
      logit_bias: { 123: 1 },
      functions: [],
    } as never;

    await model.completionWithRetry(request);

    expect(request).not.toHaveProperty("frequency_penalty");
    expect(request).not.toHaveProperty("presence_penalty");
    expect(request).not.toHaveProperty("logit_bias");
    expect(request).not.toHaveProperty("functions");
    expect(spy).toHaveBeenCalledOnce();
  });

  test("toJSON omits inherited OpenAI configuration fields", () => {
    const model = new ChatTogetherAI({ apiKey: "test-api-key" });
    const serialized = model.toJSON();

    expect(JSON.stringify(serialized)).not.toContain("openai_api_key");
    expect(JSON.stringify(serialized)).not.toContain("configuration");
  });
});
