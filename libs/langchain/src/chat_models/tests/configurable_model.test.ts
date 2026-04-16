import { describe, it, expect, vi, afterEach } from "vitest";
import { ConfigurableModel, initChatModel } from "../universal.js";
import * as universal from "../universal.js";

class DummyChatModel {
  profile: Record<string, unknown>;

  constructor(fields: { model?: string }) {
    this.profile = { maxInputTokens: fields.model ? 999 : 0 };
  }
}

describe("ConfigurableModel._getCacheKey", () => {
  it("ignores __pregel_ keys under config.configurable", () => {
    const model = new ConfigurableModel({});
    const config1 = { configurable: { model: "gpt-4o", __pregel_foo: "bar" } };
    const config2 = { configurable: { model: "gpt-4o" } };

    expect(model._getCacheKey(config1)).toBe(model._getCacheKey(config2));
  });

  it("returns deterministic key for undefined or empty config", () => {
    const model = new ConfigurableModel({});
    const keyEmpty = model._getCacheKey({});
    const keyUndefined = model._getCacheKey(undefined);

    expect(typeof keyEmpty).toBe("string");
    expect(keyEmpty).toBe(keyUndefined);
  });
});

describe("ConfigurableModel._getModelInstance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns same instance when called with no config (default cache key)", async () => {
    vi.spyOn(universal, "getChatModelByClassName").mockResolvedValue(
      DummyChatModel as never
    );

    const model = await initChatModel("gpt-4o-mini");
    const instance1 = await model._getModelInstance();
    const instance2 = await model._getModelInstance();

    expect(instance1).toBe(instance2);
  });

  it("caches instances for identical cache keys", async () => {
    vi.spyOn(universal, "getChatModelByClassName").mockResolvedValue(
      DummyChatModel as never
    );

    const model = await initChatModel("gpt-4o-mini");
    const config = { configurable: { model: "gpt-4o" } };
    const instance1 = await model._getModelInstance(config);
    const instance2 = await model._getModelInstance(config);

    expect(instance1).toBe(instance2);
  });

  it("reuses cached instances when only __pregel_ keys differ", async () => {
    vi.spyOn(universal, "getChatModelByClassName").mockResolvedValue(
      DummyChatModel as never
    );

    const model = await initChatModel("gpt-4o-mini");
    const config1 = { configurable: { model: "gpt-4o", __pregel_foo: "bar" } };
    const config2 = { configurable: { model: "gpt-4o", __pregel_foo: "baz" } };

    const instance1 = await model._getModelInstance(config1);
    const instance2 = await model._getModelInstance(config2);

    expect(instance1).toBe(instance2);
  });

  it("does not reuse cached instances when real configurable fields differ", async () => {
    vi.spyOn(universal, "getChatModelByClassName").mockResolvedValue(
      DummyChatModel as never
    );

    const model = await initChatModel("gpt-4o-mini");

    const instance1 = await model._getModelInstance({
      configurable: { model: "gpt-4o" },
    });
    const instance2 = await model._getModelInstance({
      configurable: { model: "gpt-4o-mini" },
    });

    expect(instance1).not.toBe(instance2);
  });
});

describe("ConfigurableModel.profile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns explicit profile override (even after caching an inner instance)", async () => {
    vi.spyOn(universal, "getChatModelByClassName").mockResolvedValue(
      DummyChatModel as never
    );

    const model = await initChatModel("gpt-4o-mini", {
      profile: { maxInputTokens: 1 },
    });
    await model._getModelInstance();

    expect(model.profile.maxInputTokens).toBe(1);
  });

  it("returns {} if no explicit profile exists and no cached instance exists", () => {
    const model = new ConfigurableModel({});
    expect(model.profile).toEqual({});
  });

  it("returns the cached inner instance profile when no explicit profile exists", async () => {
    vi.spyOn(universal, "getChatModelByClassName").mockResolvedValue(
      DummyChatModel as never
    );

    const model = await initChatModel("gpt-4o-mini", {});
    expect(model.profile.maxInputTokens).toBe(128000);
  });
});
