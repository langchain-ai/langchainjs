import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

import {
  browserTool,
  isBrowserTool,
  extractBrowserToolInterrupt,
} from "../browser.js";

describe("browserTool", () => {
  const testSchema = z.object({
    message: z.string(),
  });

  const testExecute = vi.fn().mockResolvedValue({ success: true });

  const testTool = browserTool({
    name: "test_tool",
    description: "A test browser tool",
    schema: testSchema,
    execute: testExecute,
  });

  it("should create a tool with correct properties", () => {
    expect(testTool.name).toBe("test_tool");
    expect(testTool.description).toBe("A test browser tool");
    expect(testTool.execute).toBe(testExecute);
  });

  it("should have browserTool metadata", () => {
    expect(testTool.metadata).toEqual({ browserTool: true });
  });

  it("should throw when called outside graph context (interrupt behavior)", async () => {
    // When called outside of a graph context, interrupt() throws an error
    // This is expected behavior - the tool should only be invoked within a LangGraph
    await expect(
      testTool.invoke(
        { message: "hello" },
        { toolCall: { id: "test-id", name: "test_tool", args: {} } }
      )
    ).rejects.toThrow(); // Will throw because interrupt() requires graph context
  });

  it("should be detectable with isBrowserTool", () => {
    expect(isBrowserTool(testTool)).toBe(true);
  });

  it("should not detect regular objects as browser tools", () => {
    expect(isBrowserTool({})).toBe(false);
    expect(isBrowserTool(null)).toBe(false);
    expect(isBrowserTool(undefined)).toBe(false);
    expect(isBrowserTool({ name: "test" })).toBe(false);
    expect(isBrowserTool({ execute: () => {} })).toBe(false);
  });
});

describe("extractBrowserToolInterrupt", () => {
  it("should extract valid browser tool interrupt data", () => {
    const interruptValue = {
      type: "browser_tool",
      toolCall: {
        id: "call-123",
        name: "get_location",
        args: { highAccuracy: true },
      },
    };

    const result = extractBrowserToolInterrupt(interruptValue);

    expect(result).toEqual({
      id: "call-123",
      name: "get_location",
      args: { highAccuracy: true },
    });
  });

  it("should return null for non-browser tool interrupts", () => {
    expect(extractBrowserToolInterrupt(null)).toBe(null);
    expect(extractBrowserToolInterrupt(undefined)).toBe(null);
    expect(extractBrowserToolInterrupt({})).toBe(null);
    expect(extractBrowserToolInterrupt({ type: "other" })).toBe(null);
    expect(
      extractBrowserToolInterrupt({ type: "browser_tool", toolCall: null })
    ).toBe(null);
    expect(
      extractBrowserToolInterrupt({
        type: "browser_tool",
        toolCall: { id: 123, name: "test" },
      })
    ).toBe(null);
  });
});

describe("browserTool schema validation", () => {
  it("should create a tool with complex schema", () => {
    const complexTool = browserTool({
      name: "complex_tool",
      description: "A tool with complex schema",
      schema: z.object({
        required: z.string(),
        optional: z.number().optional(),
        nested: z
          .object({
            field: z.boolean(),
          })
          .optional(),
      }),
      execute: async (args) => args,
    });

    expect(complexTool.name).toBe("complex_tool");
    expect(isBrowserTool(complexTool)).toBe(true);
  });
});
