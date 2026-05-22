import { afterEach, describe, it, expect } from "vitest";
import { initChatModel } from "../universal.js";

const originalNearAIApiKey = process.env.NEARAI_API_KEY;
const originalOpenAIApiKey = process.env.OPENAI_API_KEY;

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  restoreEnv("NEARAI_API_KEY", originalNearAIApiKey);
  restoreEnv("OPENAI_API_KEY", originalOpenAIApiKey);
});

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

describe("NEAR AI provider", () => {
  it("configures the OpenAI-compatible chat completions endpoint", async () => {
    process.env.NEARAI_API_KEY = "nearai-test-key";
    process.env.OPENAI_API_KEY = "openai-test-key";

    const model = await initChatModel("nearai:anthropic/claude-haiku-4-5", {
      maxTokens: 16,
      temperature: 0,
    });
    const innerModel = await (
      model as {
        _getModelInstance(): Promise<{
          identifyingParams(): Record<string, unknown>;
        }>;
      }
    )._getModelInstance();

    const params = innerModel.identifyingParams();
    expect(params.apiKey).toBe("nearai-test-key");
    expect(params.baseURL).toBe("https://cloud-api.near.ai/v1");
    expect(params.model).toBe("anthropic/claude-haiku-4-5");
    expect(params.model_name).toBe("anthropic/claude-haiku-4-5");
    expect(params.max_tokens).toBe(16);
    expect(params.max_completion_tokens).toBeUndefined();
  });

  it("does not fall back to OPENAI_API_KEY", async () => {
    delete process.env.NEARAI_API_KEY;
    process.env.OPENAI_API_KEY = "openai-test-key";

    await expect(
      initChatModel("nearai:anthropic/claude-haiku-4-5")
    ).rejects.toThrow("NEARAI_API_KEY");
  });
});
