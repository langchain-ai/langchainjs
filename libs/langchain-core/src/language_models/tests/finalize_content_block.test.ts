import { describe, expect, test } from "vitest";
import { finalizeContentBlock } from "../compat.js";

describe("finalizeContentBlock", () => {
  test("empty args string becomes valid zero-arg tool_call", () => {
    // Providers (e.g. Bedrock Converse) seed tool_call_chunk with args: ""
    // and never send an input delta for parameterless tools. Using `??`
    // left "" through to JSON.parse(""), which became invalid_tool_call.
    const result = finalizeContentBlock({
      type: "tool_call_chunk",
      id: "tooluse_1",
      name: "list_things",
      args: "",
      index: 0,
    });

    expect(result).toEqual({
      type: "tool_call",
      id: "tooluse_1",
      name: "list_things",
      args: {},
    });
  });

  test("undefined args also become valid zero-arg tool_call", () => {
    const result = finalizeContentBlock({
      type: "tool_call_chunk",
      id: "tooluse_2",
      name: "ping",
      index: 0,
    } as Parameters<typeof finalizeContentBlock>[0]);

    expect(result).toEqual({
      type: "tool_call",
      id: "tooluse_2",
      name: "ping",
      args: {},
    });
  });

  test("malformed args still become invalid_tool_call", () => {
    const result = finalizeContentBlock({
      type: "tool_call_chunk",
      id: "tooluse_3",
      name: "broken",
      args: "{not-json",
      index: 0,
    });

    expect(result).toMatchObject({
      type: "invalid_tool_call",
      id: "tooluse_3",
      name: "broken",
      args: "{not-json",
    });
  });
});
