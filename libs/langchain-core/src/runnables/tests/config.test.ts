import { describe, it, expect } from "vitest";
import { mergeConfigs, ensureConfig } from "../config.js";
import { getInheritableMetadataFromConfigurable } from "../../tracers/tracer_langchain.js";

describe("mergeConfigs metadata", () => {
  it("merges metadata with last-writer-wins", () => {
    const result = mergeConfigs(
      { metadata: { ls_provider: "openai", ls_model_type: "chat" } },
      { metadata: { ls_provider: "anthropic", ls_temperature: 0.7 } }
    );
    expect(result.metadata).toEqual({
      ls_provider: "anthropic",
      ls_model_type: "chat",
      ls_temperature: 0.7,
    });
  });

  it("merges metadata across three configs", () => {
    const result = mergeConfigs(
      { metadata: { a: 1 } },
      { metadata: { b: 2 } },
      { metadata: { c: 3 } }
    );
    expect(result.metadata).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("later config overwrites earlier for same key", () => {
    const result = mergeConfigs({ metadata: { a: 1 } }, { metadata: { a: 2 } });
    expect(result.metadata).toEqual({ a: 2 });
  });

  it("handles undefined and null configs", () => {
    const result = mergeConfigs(undefined, { metadata: { a: 1 } }, null);
    expect(result.metadata).toEqual({ a: 1 });
  });

  it("handles empty metadata", () => {
    const result = mergeConfigs({ metadata: {} }, { metadata: { a: 1 } });
    expect(result.metadata).toEqual({ a: 1 });
  });
});

describe("ensureConfig configurable-to-metadata", () => {
  it("copies only model to shared metadata", () => {
    const config = ensureConfig({
      configurable: {
        thread_id: "th-123",
        checkpoint_id: "ckpt-1",
        model: "gpt-4o",
        user_id: "uid-1",
        custom_setting: 42,
      },
      metadata: { nooverride: 18 },
    });

    // Only model is copied; everything else stays out of shared metadata
    expect(config.metadata).toEqual({ nooverride: 18, model: "gpt-4o" });
  });

  it("does not override existing model in metadata", () => {
    const config = ensureConfig({
      configurable: { model: "from-configurable" },
      metadata: { model: "from-metadata" },
    });

    expect(config.metadata).toEqual({ model: "from-metadata" });
  });

  it("skips non-string model values", () => {
    const config = ensureConfig({
      configurable: { model: 42 },
      metadata: {},
    });

    expect(config.metadata).toEqual({});
  });
});

describe("getInheritableMetadataFromConfigurable", () => {
  it("extracts all primitive configurable keys", () => {
    const result = getInheritableMetadataFromConfigurable({
      thread_id: "th-123",
      model: "gpt-4o",
      user_id: "uid-1",
      temperature: 0.5,
      streaming: true,
      custom_setting: { nested: true }, // not a primitive
      none_value: null, // not a primitive
    });
    expect(result).toEqual({
      thread_id: "th-123",
      model: "gpt-4o",
      user_id: "uid-1",
      temperature: 0.5,
      streaming: true,
    });
  });

  it("excludes keys starting with __", () => {
    const result = getInheritableMetadataFromConfigurable({
      __secret_key: "hidden",
      visible: "shown",
    });
    expect(result).toEqual({ visible: "shown" });
  });

  it("excludes api_key", () => {
    const result = getInheritableMetadataFromConfigurable({
      api_key: "should-not-propagate",
      thread_id: "th-123",
    });
    expect(result).toEqual({ thread_id: "th-123" });
  });

  it("excludes keys already in existingMetadata", () => {
    const result = getInheritableMetadataFromConfigurable(
      {
        model: "from-configurable",
        checkpoint_ns: "from-configurable",
        thread_id: "th-123",
      },
      { model: "from-metadata", checkpoint_ns: "from-metadata" }
    );
    expect(result).toEqual({ thread_id: "th-123" });
  });

  it("returns undefined when no configurable keys match", () => {
    expect(
      getInheritableMetadataFromConfigurable({
        __hidden: "value",
        api_key: "secret",
        nested: { a: 1 },
      })
    ).toBeUndefined();
  });

  it("returns undefined when configurable is undefined", () => {
    expect(getInheritableMetadataFromConfigurable(undefined)).toBeUndefined();
  });
});
