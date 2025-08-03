import { describe, it, expect } from "@jest/globals";
import { z } from "zod";
import { z as z4 } from "zod/v4";
import {
  DynamicStructuredTool,
  DynamicTool,
  StructuredTool,
  StructuredToolInterface,
  Tool,
  ToolInterface,
  tool,
} from "../index.js";
import { ToolCall, ToolMessage } from "../../messages/tool.js";

const testDynamicTool = new DynamicTool({
  name: "test",
  description: "test",
  func: async (input) => `test ${input}`,
});

const testDynamicStructuredTool = new DynamicStructuredTool({
  name: "test",
  description: "test",
  func: async ({ input }) => `test ${input}`,
  schema: z.object({ input: z.string() }),
});

const testDynamicStructuredToolWithZodEffects = new DynamicStructuredTool({
  name: "test",
  description: "test",
  func: async (input) => `test ${input}`,
  schema: z
    .object({ input: z.string().optional() })
    .transform((data) => data.input),
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

    describe("invoke return type", () => {
      it("should be assignable to ToolMessage when input is ToolCall", async () => {
        const toolCall: ToolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        };
        const output: ToolMessage = await testDynamicTool.invoke(toolCall);
        expect(output).toBeInstanceOf(ToolMessage);
      });

      it("should be assignable to ToolOutputT when input is not ToolCall", async () => {
        const output: string = await testDynamicTool.invoke({ input: "test" });
        expect(output).toBe("test test");
      });

      it("should be ToolMessage | TOutput when toolCall is present in config with ambiguous ID type", async () => {
        const toolCall: ToolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        };

        const output: ToolMessage | string = await testDynamicTool.invoke(
          toolCall.args,
          { toolCall }
        );
        expect(output).toBeInstanceOf(ToolMessage);
      });

      it("should be ToolMessage when toolCall is present in config with string ID type", async () => {
        const toolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        } as const;

        const output: ToolMessage = await testDynamicTool.invoke(
          toolCall.args,
          { toolCall }
        );
        expect(output).toBeInstanceOf(ToolMessage);
      });

      it("should be assignable to ToolOutputT when input is a ToolCall but direct output is requested", async () => {
        const toolCall: ToolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        };

        type ToolOutputT = {
          lc_direct_tool_output: true;
          output: string;
        };

        const directOutputDynamicTool = new DynamicTool({
          name: "test",
          description: "test",
          func: async (input: string) =>
            ({
              lc_direct_tool_output: true,
              output: `test ${input}`,
            } as ToolOutputT),
        });

        const output: ToolOutputT = await directOutputDynamicTool.invoke(
          toolCall
        );

        expect(output).toEqual({
          lc_direct_tool_output: true,
          output: "test test",
        });
      });
    });

    describe("call return type", () => {
      it("should be assignable to ToolMessage when input is ToolCall", async () => {
        const toolCall: ToolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        };

        const output: ToolMessage = await testDynamicTool.call(toolCall);
        expect(output).toBeInstanceOf(ToolMessage);
      });

      it("should be ToolMessage | TOutput when toolCall is present in config with ambiguous ID type", async () => {
        const toolCall: ToolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        };

        const output: ToolMessage | string = await testDynamicTool.call(
          toolCall.args,
          { toolCall }
        );
        expect(output).toBeInstanceOf(ToolMessage);
      });

      it("should be ToolMessage when toolCall is present in config with string ID type", async () => {
        const toolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        } as const;

        const output: ToolMessage = await testDynamicTool.call(toolCall.args, {
          toolCall,
        });
        expect(output).toBeInstanceOf(ToolMessage);
      });

      it("should be assignable to ToolOutputT when input is a ToolCall but direct output is requested", async () => {
        const toolCall: ToolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        };

        type ToolOutputT = {
          lc_direct_tool_output: true;
          output: string;
        };

        const directOutputDynamicTool = new DynamicTool({
          name: "test",
          description: "test",
          func: async (input: string) =>
            ({
              lc_direct_tool_output: true,
              output: `test ${input}`,
            } as ToolOutputT),
        });

        const output: ToolOutputT = await directOutputDynamicTool.call(
          toolCall
        );

        expect(output).toEqual({
          lc_direct_tool_output: true,
          output: "test test",
        });
      });
    });
  });

  describe("DynamicStructuredTool", () => {
    it("should not be assignable to Tool", () => {
      // @ts-expect-error DynamicStructuredTool uses a string schema and is not compatible with Tool
      const tool: Tool = testDynamicStructuredTool;
      expect(tool).toBe(testDynamicStructuredTool);
    });
    it("should not be assignable to ToolInterface if not narrowed to have input type `{ input: string }`", () => {
      // @ts-expect-error DynamicStructuredTool uses a string schema and is not compatible with ToolInterface without proper narrowing
      const toolInterface: ToolInterface = testDynamicStructuredTool;
      expect(toolInterface).toBe(testDynamicStructuredTool);
    });
    it("should be assignable to ToolInterface if narrowed to use ZodEffects schema`", () => {
      const toolInterface: ToolInterface =
        testDynamicStructuredToolWithZodEffects;
      expect(toolInterface).toBe(testDynamicStructuredToolWithZodEffects);
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

    describe("invoke return type", () => {
      it("should be assignable to ToolMessage when input is ToolCall", async () => {
        const toolCall: ToolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        };
        const output: ToolMessage = await testDynamicStructuredTool.invoke(
          toolCall
        );
        expect(output).toBeInstanceOf(ToolMessage);
      });

      it("should be assignable to ToolOutputT when input is not ToolCall", async () => {
        const output: string = await testDynamicStructuredTool.invoke({
          input: "test",
        });
        expect(output).toBe("test test");
      });

      it("should be ToolMessage | TOutput when toolCall is present in config with ambiguous ID type", async () => {
        const toolCall: ToolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        };

        const output: ToolMessage | string =
          await testDynamicStructuredTool.invoke(
            toolCall.args as { input: string },
            {
              toolCall,
            }
          );
        expect(output).toBeInstanceOf(ToolMessage);
      });

      it("should be ToolMessage when toolCall is present in config with string ID type", async () => {
        const toolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        } as const;

        const output: ToolMessage = await testDynamicStructuredTool.invoke(
          toolCall.args,
          { toolCall }
        );
        expect(output).toBeInstanceOf(ToolMessage);
      });

      it("should be assignable to ToolOutputT when input is a ToolCall but direct output is requested", async () => {
        const toolCall: ToolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        };

        type ToolOutputT = {
          lc_direct_tool_output: true;
          output: string;
        };

        const directOutputDynamicTool = new DynamicTool({
          name: "test",
          description: "test",
          func: async (input: string) =>
            ({
              lc_direct_tool_output: true,
              output: `test ${input}`,
            } as ToolOutputT),
        });

        const output: ToolOutputT = await directOutputDynamicTool.invoke(
          toolCall
        );

        expect(output).toEqual({
          lc_direct_tool_output: true,
          output: "test test",
        });
      });

      it("should be the transformed schema output type when using ZodEffects schema", async () => {
        const output: string =
          await testDynamicStructuredToolWithZodEffects.invoke({
            input: "test",
          });
        expect(output).toBe("test test");
      });
    });

    describe("call return type", () => {
      it("should be assignable to ToolMessage when input is ToolCall", async () => {
        const toolCall: ToolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        };

        const output: ToolMessage = await testDynamicStructuredTool.call(
          toolCall
        );
        expect(output).toBeInstanceOf(ToolMessage);
      });

      it("should be ToolMessage | TOutput when toolCall is present in config with ambiguous ID type", async () => {
        const toolCall: ToolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        };

        const output = await testDynamicStructuredTool.call(
          toolCall.args as { input: string },
          {
            toolCall,
          }
        );

        // @ts-expect-error string | ToolMessage isn't assignable to string
        const _strOutput: string = output;

        // @ts-expect-error ToolMessage isn't assignable to string
        const _toolMessageOutput: ToolMessage = output;

        expect(output).toBeInstanceOf(ToolMessage);
      });

      it("should be ToolMessage when toolCall is present in config with string ID type", async () => {
        const toolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        } as const;

        const output: ToolMessage = await testDynamicStructuredTool.call(
          toolCall.args,
          {
            toolCall,
          }
        );
        expect(output).toBeInstanceOf(ToolMessage);
      });

      it("should be assignable to ToolOutputT when input is a ToolCall but direct output is requested", async () => {
        const toolCall: ToolCall = {
          id: "1",
          name: "test",
          args: { input: "test" },
          type: "tool_call",
        };

        type ToolOutputT = {
          lc_direct_tool_output: true;
          output: string;
        };

        const directOutputDynamicTool = new DynamicStructuredTool({
          name: "test",
          description: "test",
          func: async (input: { input: string }) =>
            ({
              lc_direct_tool_output: true,
              output: `test ${input.input}`,
            } as ToolOutputT),
          schema: z.object({ input: z.string() }),
        });

        const output: ToolOutputT = await directOutputDynamicTool.call(
          toolCall.args as { input: string }
        );

        expect(output).toEqual({
          lc_direct_tool_output: true,
          output: "test test",
        });
      });
    });
  });
});

describe("tool factory function type tests", () => {
  describe("with no schema (defaults to string)", () => {
    it("should return DynamicTool when no schema is provided", () => {
      const testTool = tool(
        async (input) => {
          const typedInput: string = input;
          return `processed: ${typedInput}`;
        },
        {
          name: "test_tool",
          description: "A test tool",
        }
      );
      const dynamicTool: DynamicTool<string> = testTool;
      expect(dynamicTool).toBe(testTool);
      expect(testTool).toBeInstanceOf(DynamicTool);
      // @ts-expect-error dynamicTool should not be assignable to DynamicStructuredTool.
      // If it is assignable, that would indicate that the tool factory is using the
      // overload with the union return type (bad).
      const _structuredTool: DynamicStructuredTool = testTool;
      expect(_structuredTool).toBe(testTool);
    });
  });

  describe("with Zod string schema", () => {
    it("should return DynamicTool when schema is z.string()", () => {
      const testTool = tool(
        async (input) => {
          const typedInput: string = input;
          return `processed: ${typedInput}`;
        },
        {
          name: "test_tool",
          description: "A test tool",
          schema: z.string(),
        }
      );

      const dynamicTool: DynamicTool<string> = testTool;
      expect(dynamicTool).toBe(testTool);
      expect(testTool).toBeInstanceOf(DynamicTool);
      // @ts-expect-error dynamicTool should not be assignable to DynamicStructuredTool.
      // If it is assignable, that would indicate that the tool factory is using the
      // overload with the union return type (bad).
      const _structuredTool: DynamicStructuredTool = testTool;
      expect(_structuredTool).toBe(testTool);
    });

    it("should return DynamicStructuredTool when schema is z.string().optional() (non-standard schema)", () => {
      const testTool = tool(
        async (input) => {
          const typedInput: string | undefined = input;
          return `processed: ${typedInput ?? "empty"}`;
        },
        {
          name: "test_tool",
          schema: z.string().optional(),
        }
      );

      const structuredTool: DynamicStructuredTool = testTool;
      expect(structuredTool).toBe(testTool);
      expect(testTool).toBeInstanceOf(DynamicStructuredTool);
      // @ts-expect-error structuredTool should not be assignable to DynamicTool.
      // If it is assignable, that would indicate that the tool factory is using the
      // overload with the union return type (bad).
      const _dynamicTool: DynamicTool = testTool;
      expect(_dynamicTool).toBe(testTool);
    });
  });

  describe("with Zod object schema", () => {
    describe("should return DynamicStructuredTool when schema is z.object()", () => {
      it("zod v3", () => {
        const testTool = tool(
          async (input) => {
            const typedInput: { name: string; age: number } = input;
            return `Hello ${typedInput.name}, you are ${typedInput.age} years old`;
          },
          {
            name: "greet_tool",
            description: "Greets a person",
            schema: z.object({
              name: z.string(),
              age: z.number(),
            }),
          }
        );

        const structuredTool: DynamicStructuredTool<
          z.ZodObject<{ name: z.ZodString; age: z.ZodNumber }>,
          { name: string; age: number },
          { name: string; age: number },
          string
        > = testTool;
        expect(structuredTool).toBe(testTool);
        expect(testTool).toBeInstanceOf(DynamicStructuredTool);
        // @ts-expect-error structuredTool should not be assignable to DynamicTool.
        // If it is assignable, that would indicate that the tool factory is using the
        // overload with the union return type (bad).
        const _dynamicTool: DynamicTool = testTool;
        expect(_dynamicTool).toBe(testTool);
      });
      it("zod v4", () => {
        const testTool = tool(
          async (input) => {
            const typedInput: { name: string; age: number } = input;
            return `Hello ${typedInput.name}, you are ${typedInput.age} years old`;
          },
          {
            name: "greet_tool",
            description: "Greets a person",
            schema: z4.object({
              name: z4.string(),
              age: z4.number(),
            }),
          }
        );

        const structuredTool: DynamicStructuredTool<
          z4.ZodObject<{ name: z4.ZodString; age: z4.ZodNumber }>,
          { name: string; age: number },
          { name: string; age: number },
          string
        > = testTool;
        expect(structuredTool).toBe(testTool);
        expect(testTool).toBeInstanceOf(DynamicStructuredTool);
        // @ts-expect-error structuredTool should not be assignable to DynamicTool.
        // If it is assignable, that would indicate that the tool factory is using the
        // overload with the union return type (bad).
        const _dynamicTool: DynamicTool = testTool;
        expect(_dynamicTool).toBe(testTool);
      });
    });

    it("should return DynamicStructuredTool when schema is transformed into a string", () => {
      const testTool = tool(async (input) => `result: ${input}`, {
        name: "test_tool",
        schema: z.object({ value: z.string() }).transform((obj) => obj.value),
      });

      const structuredTool: DynamicStructuredTool = testTool;
      expect(structuredTool).toBe(testTool);
      expect(testTool).toBeInstanceOf(DynamicStructuredTool);
      // @ts-expect-error structuredTool should not be assignable to DynamicTool.
      // If it is assignable, that would indicate that the tool factory is using the
      // overload with the union return type (bad).
      const _dynamicTool: DynamicTool = testTool;
      expect(_dynamicTool).toBe(testTool);
    });
  });
});
