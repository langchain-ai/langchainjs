import { z } from "zod";
import {
  DynamicStructuredTool,
  DynamicTool,
  StructuredTool,
  StructuredToolInterface,
  Tool,
  ToolInterface,
} from "../index.js";
import { StringInputToolSchema } from "../types.js";

const testDynamicTool = new DynamicTool({
  name: "test",
  description: "test",
  func: async (input: string) => `test ${input}`,
});

const testDynamicStructuredTool = new DynamicStructuredTool({
  name: "test",
  description: "test",
  func: async (input: string) => `test ${input}`,
  schema: z.string(),
});

describe("tool type tests", () => {
  describe("DynamicTool", () => {
    it("should be assignable to Tool", () => {
      const tool: Tool = testDynamicTool;
      expect(tool).toBe(testDynamicTool);
    });
    it("should be assignable to ToolInterface", () => {
      const toolInterface: ToolInterface = testDynamicTool;
      expect(toolInterface).toBe(testDynamicTool);
    });
    it("should be assignable to StructuredTool", () => {
      const structuredTool: StructuredTool = testDynamicTool;
      expect(structuredTool).toBe(testDynamicTool);
    });
    it("should be assignable to StructuredToolInterface", () => {
      const structuredToolInterface: StructuredToolInterface = testDynamicTool;
      expect(structuredToolInterface).toBe(testDynamicTool);
    });
  });

  describe("DynamicStructuredTool", () => {
    it("should not be assignable to Tool", () => {
      // @ts-expect-error
      const tool: Tool = testDynamicStructuredTool;
      expect(tool).toBe(testDynamicStructuredTool);
    });
    it("should not be assignable to ToolInterface if not narrowed to have input type `{ input: string }`", () => {
      // @ts-expect-error
      const toolInterface: ToolInterface = testDynamicStructuredTool;
      expect(toolInterface).toBe(testDynamicStructuredTool);
    });
    it("should be assignable to ToolInterface if narrowed to use ZodEffects schema`", () => {
      (dynamicStructuredTool: DynamicStructuredTool<StringInputToolSchema>) => {
        const toolInterface: ToolInterface = dynamicStructuredTool;
        expect(toolInterface).toBe(dynamicStructuredTool);
      };
    });
    it("should be assignable to StructuredTool", () => {
      const structuredTool: StructuredTool = testDynamicStructuredTool;
      expect(structuredTool).toBe(testDynamicStructuredTool);
    });
    it("should be assignable to StructuredToolInterface with default type params", () => {
      const structuredToolInterface: StructuredToolInterface =
        testDynamicStructuredTool;
      expect(structuredToolInterface).toBe(testDynamicStructuredTool);
    });
  });
});
