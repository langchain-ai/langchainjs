import { describe, it, expect } from "vitest";
import { mergeConfigs } from "../config.js";

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
    const result = mergeConfigs(
      { metadata: { a: 1 } },
      { metadata: { a: 2 } }
    );
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
