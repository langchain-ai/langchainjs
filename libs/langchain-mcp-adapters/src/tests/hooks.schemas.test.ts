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

  test.each([{ text: "hello" }, { blob: "aGVsbG8=" }])(
    "preserves MCP resource extensions through the SDK schema: %j",
    (content) => {
      const modification = {
        result: [
          "result",
          [
            {
              type: "resource",
              resource: {
                uri: "file:///test.txt",
                ...content,
                extension: { value: 42 },
              },
              annotations: { priority: 0.5, extension: "annotation" },
              extension: "resource",
            },
          ],
        ],
      };

      expect(toolCallResultModificationSchema.parse(modification)).toEqual(
        modification
      );
    }
  );

  test.each([
    { result: [[42], []] },
    { result: ["result", [null]] },
    { result: ["result", [{ type: "resource", resource: {} }]] },
    {
      result: [
        "result",
        [{ type: "resource", resource: { uri: 42, text: "hello" } }],
      ],
    },
    {
      result: [
        "result",
        [{ type: "resource", resource: { uri: "file:///test.txt", text: 42 } }],
      ],
    },
    {
      result: [
        "result",
        [{ type: "resource", resource: { uri: "file:///test.txt", blob: 42 } }],
      ],
    },
    {
      result: [
        "result",
        [
          {
            type: "resource",
            resource: { uri: "file:///test.txt", text: "hello" },
            annotations: { priority: "high" },
          },
        ],
      ],
    },
    { result: ["result", [{ data: "missing type" }]] },
    { result: [[{ type: "text", id: 42 }], []] },
  ])("rejects malformed result blocks: %j", (modification) => {
    expect(
      toolCallResultModificationSchema.safeParse(modification).success
    ).toBe(false);
  });
});
