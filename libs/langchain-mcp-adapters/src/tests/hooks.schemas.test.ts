import { describe, expect, test } from "vitest";
import { toolCallResultModificationSchema } from "../hooks.js";

describe("hook result parsing", () => {
  test("preserves provider extensions and legacy artifact blocks", () => {
    const modification = {
      result: [
        [{ type: "provider_block", provider: { value: 42 } }],
        [
          {
            type: "image",
            source_type: "base64",
            data: "aGVsbG8=",
            mime_type: "image/png",
          },
        ],
      ],
    };

    expect(toolCallResultModificationSchema.parse(modification)).toEqual(
      modification
    );
  });

  test("accepts MCP resources through the SDK schema", () => {
    const modification = {
      result: [
        "result",
        [
          {
            type: "resource",
            resource: { uri: "file:///test.txt", text: "hello" },
          },
        ],
      ],
    };

    expect(toolCallResultModificationSchema.parse(modification)).toEqual(
      modification
    );
  });

  test.each([
    { result: [[42], []] },
    { result: ["result", [null]] },
    { result: ["result", [{ type: "resource", resource: {} }]] },
    { result: ["result", [{ data: "missing type" }]] },
    { result: [[{ type: "text", id: 42 }], []] },
  ])("rejects malformed result blocks: %j", (modification) => {
    expect(
      toolCallResultModificationSchema.safeParse(modification).success
    ).toBe(false);
  });
});
