import { describe, it, expect } from "vitest";
import { initChatModel } from "../universal.js";

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

describe("ConfigurableModel critical units", () => {
  it("_getCacheKey should ignore __pregel_ keys", async () => {
    const model = await initChatModel("gpt-4o-mini");
    const config1 = { configurable: { model: "gpt-4o", __pregel_foo: "bar" } };
    const config2 = { configurable: { model: "gpt-4o" } };
    
    expect(model._getCacheKey(config1)).toBe(model._getCacheKey(config2));
  });

  it("_getModelInstance should cache instances", async () => {
    const model = await initChatModel("gpt-4o-mini");
    
    const instance1 = await model._getModelInstance();
    const instance2 = await model._getModelInstance();
    
    expect(instance1).toBe(instance2);
  });
});
