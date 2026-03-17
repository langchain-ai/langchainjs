import { describe, it, expect } from "vitest";
import { z } from "zod";

import { tool } from "../headless.js";

describe("tool (headless)", () => {
  const testSchema = z.object({
    message: z.string(),
  });

  const testTool = tool({
    name: "test_tool",
    description: "A test headless tool",
    schema: testSchema,
  });

  it("should create a tool with correct properties", () => {
    expect(testTool.name).toBe("test_tool");
    expect(testTool.description).toBe("A test headless tool");
    expect(typeof testTool.implement).toBe("function");
  });

  it("should have headlessTool metadata", () => {
    expect(testTool.metadata).toEqual({ headlessTool: true });
  });

  it("should throw when called outside graph context (interrupt behavior)", async () => {
    await expect(
      testTool.invoke(
        { message: "hello" },
        { toolCall: { id: "test-id", name: "test_tool", args: {} } }
      )
    ).rejects.toThrow();
  });

  it("should pair with an implementation via implement()", () => {
    const execute = async ({ message }: { message: string }) =>
      `echo: ${message}`;

    const impl = testTool.implement(execute);

    expect(impl.tool).toBe(testTool);
    expect(impl.execute).toBe(execute);
  });
});

describe("tool (headless) schema validation", () => {
  it("should create a tool with complex schema", () => {
    const complexTool = tool({
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
    });

    expect(complexTool.name).toBe("complex_tool");
    expect(complexTool.metadata).toEqual({ headlessTool: true });
    expect(typeof complexTool.implement).toBe("function");
  });
});
