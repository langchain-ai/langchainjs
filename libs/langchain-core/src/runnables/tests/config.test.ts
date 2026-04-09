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
  it("does not copy configurable primitives to metadata", () => {
    const config = ensureConfig({
      configurable: {
        thread_id: "th-123",
        checkpoint_id: "ckpt-1",
        checkpoint_ns: "ns-1",
        task_id: "task-1",
        run_id: "run-456",
        assistant_id: "asst-789",
        graph_id: "graph-0",
        model: "gpt-4o",
        user_id: "uid-1",
        cron_id: "cron-1",
        langgraph_auth_user_id: "user-1",
        some_api_key: "opaque-token",
        custom_setting: 42,
      },
      metadata: { nooverride: 18 },
    });

    // Metadata should only contain the explicitly provided key
    expect(config.metadata).toEqual({ nooverride: 18 });
    // Configurable should be untouched
    expect(config.configurable).toEqual({
      thread_id: "th-123",
      checkpoint_id: "ckpt-1",
      checkpoint_ns: "ns-1",
      task_id: "task-1",
      run_id: "run-456",
      assistant_id: "asst-789",
      graph_id: "graph-0",
      model: "gpt-4o",
      user_id: "uid-1",
      cron_id: "cron-1",
      langgraph_auth_user_id: "user-1",
      some_api_key: "opaque-token",
      custom_setting: 42,
    });
  });

  it("metadata is not overridden by configurable", () => {
    const config = ensureConfig({
      configurable: {
        thread_id: "from-configurable",
        run_id: "from-configurable",
      },
      metadata: {
        thread_id: "from-metadata",
        run_id: "from-metadata",
      },
    });

    expect(config.metadata).toEqual({
      thread_id: "from-metadata",
      run_id: "from-metadata",
    });
  });
});

describe("getInheritableMetadataFromConfigurable", () => {
  it("extracts known string keys from configurable", () => {
    const result = getInheritableMetadataFromConfigurable({
      thread_id: "th-123",
      model: "gpt-4o",
      user_id: "uid-1",
      some_api_key: "opaque-token", // not in CONFIGURABLE_TO_METADATA_KEYS
      custom_setting: 42, // not a string
    });
    expect(result).toEqual({
      thread_id: "th-123",
      model: "gpt-4o",
      user_id: "uid-1",
    });
  });

  it("returns undefined when no configurable keys match", () => {
    expect(
      getInheritableMetadataFromConfigurable({ custom_key: "value" })
    ).toBeUndefined();
  });

  it("returns undefined when configurable is undefined", () => {
    expect(getInheritableMetadataFromConfigurable(undefined)).toBeUndefined();
  });
});
