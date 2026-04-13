import { describe, it, expect } from "vitest";
import {
  _getTracingInheritableMetadataFromConfig,
  ensureConfig,
  mergeConfigs,
} from "../config.js";

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

describe("ensureConfig tracing metadata behavior", () => {
  it("copies only configurable model into metadata", () => {
    const config = ensureConfig({
      configurable: {
        model: "gpt-4o",
        thread_id: "th-123",
        temperature: 0.2,
      },
      metadata: { explicit: true },
    });

    expect(config.metadata).toEqual({
      explicit: true,
      model: "gpt-4o",
    });
  });

  it("builds LangSmith inheritable metadata from primitive configurable values", () => {
    const config = ensureConfig({
      metadata: {
        model: "from-metadata",
        thread_id: "from-metadata",
      },
      configurable: {
        model: "from-configurable",
        thread_id: "from-configurable",
        checkpoint_id: "ckpt-1",
        temperature: 0.5,
        streaming: true,
        api_key: "should-not-propagate",
        __secret_key: "should-not-propagate",
        custom_setting: { nested: true },
        none_value: undefined,
      },
    });

    expect(_getTracingInheritableMetadataFromConfig(config)).toEqual({
      checkpoint_id: "ckpt-1",
      temperature: 0.5,
      streaming: true,
    });
  });
});
