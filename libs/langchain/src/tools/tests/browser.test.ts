import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

import { browserTool } from "../browser.js";

describe("browserTool", () => {
  const testSchema = z.object({
    message: z.string(),
  });

  const testExecute = vi.fn().mockResolvedValue({ success: true });

  // New API: function first, then fields
  const testTool = browserTool(testExecute, {
    name: "test_tool",
    description: "A test browser tool",
    schema: testSchema,
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
});

describe("browserTool schema validation", () => {
  it("should create a tool with complex schema", () => {
    const complexTool = browserTool(
      async (args) => args,
      {
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
      }
    );

    expect(complexTool.name).toBe("complex_tool");
    expect(complexTool.metadata).toEqual({ browserTool: true });
  });
});
