import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { z as z4 } from "zod/v4";
import type { JSONSchema } from "../../utils/json_schema.js";
import type { ToolCall, ToolMessage } from "../../messages/tool.js";
import type { ToolRunnableConfig } from "../types.js";
import {
  DynamicStructuredTool,
  DynamicTool,
  StructuredTool,
  Tool,
  tool,
} from "../index.js";

describe("Tool Type Tests", () => {
  describe("DynamicTool", () => {
    it("should have correct input/output types", () => {
      const dynamicTool = new DynamicTool({
        name: "test",
        description: "test tool",
        func: async (input) => {
          expectTypeOf(input).toEqualTypeOf<string>();
          return `result: ${input}`;
        },
      });

      // Test invoke with string
      expectTypeOf(dynamicTool.invoke("test")).toEqualTypeOf<Promise<string>>();

      // Test invoke with undefined
      expectTypeOf(dynamicTool.invoke(undefined)).toEqualTypeOf<
        // @ts-expect-error - undefined is not a valid input
        Promise<string>
      >();

      // Test invoke with object
      expectTypeOf(dynamicTool.invoke({ input: "test" })).toEqualTypeOf<
        Promise<string>
      >();

      // Test invoke with ToolCall
      const toolCall: ToolCall = {
        name: "test",
        args: { input: "test" },
        id: "123",
        type: "tool_call",
      };
      expectTypeOf(dynamicTool.invoke(toolCall)).toEqualTypeOf<
        Promise<ToolMessage>
      >();

      // Test with config
      const config: ToolRunnableConfig = { tags: ["test"] };
      expectTypeOf(dynamicTool.invoke("test", config)).toEqualTypeOf<
        Promise<string>
      >();
    });

    it("should support custom output types", () => {
      interface CustomOutput {
        result: string;
        metadata: { timestamp: number };
      }

      const customTool = new DynamicTool<CustomOutput>({
        name: "custom",
        description: "custom output tool",
        func: async (input) => ({
          result: input,
          metadata: { timestamp: Date.now() },
        }),
      });

      expectTypeOf(customTool.invoke("test")).toEqualTypeOf<
        Promise<CustomOutput>
      >();
    });
  });

  describe("Tool (string input)", () => {
    it("should handle string inputs correctly", () => {
      class StringTool extends Tool<string> {
        name = "stringTool";
        description = "A tool that accepts strings";

        async _call(input: string): Promise<string> {
          expectTypeOf(input).toEqualTypeOf<string>();
          return `Processed: ${input}`;
        }
      }

      const stringTool = new StringTool();

      // Direct string input
      expectTypeOf(stringTool.invoke("hello")).toEqualTypeOf<Promise<string>>();

      // Object with input property
      expectTypeOf(stringTool.invoke({ input: "hello" })).toEqualTypeOf<
        Promise<string>
      >();

      // Undefined input
      expectTypeOf(stringTool.invoke(undefined)).toEqualTypeOf<
        // @ts-expect-error - undefined is not a valid input
        Promise<string>
      >();

      // ToolCall input
      const toolCall: ToolCall = {
        name: "stringTool",
        args: { input: "hello" },
        id: "123",
        type: "tool_call",
      };
      expectTypeOf(stringTool.invoke(toolCall)).toEqualTypeOf<
        Promise<ToolMessage>
      >();
    });
  });

  describe("DynamicStructuredTool", () => {
    it("should infer schema types correctly", async () => {
      const schema = z.object({
        query: z.string(),
        maxResults: z.number().optional(),
      });

      const structuredTool = new DynamicStructuredTool({
        name: "search",
        description: "Search tool",
        schema,
        func: async (input) => {
          expectTypeOf(input).toEqualTypeOf<{
            query: string;
            maxResults?: number | undefined;
          }>();
          return `Found ${input.maxResults ?? 10} results for: ${input.query}`;
        },
      });

      // Valid input
      expectTypeOf(structuredTool.invoke({ query: "test" })).toEqualTypeOf<
        Promise<string>
      >();

      expectTypeOf(
        structuredTool.invoke({ query: "test", maxResults: 5 })
      ).toEqualTypeOf<Promise<string>>();

      // @ts-expect-error - missing required field
      await structuredTool.invoke({});

      // @ts-expect-error - wrong field type
      await structuredTool.invoke({ query: 123 });

      // extra fields are possible, though not allowed
      // we can't restrict this due to generic extends constraints in TypeScript
      await structuredTool.invoke({ query: "test", extra: "field" });
    });

    it("should work with transform schemas", () => {
      const schema = z
        .object({ input: z.string() })
        .transform((data) => data.input);

      const transformTool = new DynamicStructuredTool({
        name: "transform",
        description: "Transform tool",
        schema,
        func: async (input) => {
          expectTypeOf(input).toEqualTypeOf<string>();
          return `Transformed: ${input}`;
        },
      });

      expectTypeOf(transformTool.invoke({ input: "test" })).toEqualTypeOf<
        Promise<string>
      >();
    });

    it("should support custom output types", () => {
      interface SearchResult {
        items: Array<{ title: string; url: string }>;
        total: number;
      }

      const schema = z.object({ query: z.string() });

      const searchTool = new DynamicStructuredTool<
        typeof schema,
        z.infer<typeof schema>,
        z.input<typeof schema>,
        SearchResult
      >({
        name: "search",
        description: "Search with structured results",
        schema,
        func: async (input) => {
          expectTypeOf(input).toEqualTypeOf<{ query: string }>();
          return {
            items: [{ title: "Result", url: "https://example.com" }],
            total: 1,
          };
        },
      });

      expectTypeOf(searchTool.invoke({ query: "test" })).toEqualTypeOf<
        Promise<SearchResult>
      >();
    });
  });

  describe("tool function", () => {
    it("should infer types for string schema (z.string)", () => {
      const stringTool = tool(
        async (input) => {
          expectTypeOf(input).toEqualTypeOf<string>();
          return `Result: ${input}`;
        },
        {
          name: "stringTool",
          description: "A string tool",
          schema: z.string(),
        }
      );

      expectTypeOf(stringTool).toEqualTypeOf<DynamicTool<string>>();
      expectTypeOf(stringTool.invoke("test")).toEqualTypeOf<Promise<string>>();
      expectTypeOf(stringTool.invoke({ input: "test" })).toEqualTypeOf<
        Promise<string>
      >();
    });

    it("should infer types for object schema", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email().optional(),
      });

      const objectTool = tool(
        async (input) => {
          expectTypeOf(input).toEqualTypeOf<{
            name: string;
            age: number;
            email?: string | undefined;
          }>();
          return `User: ${input.name}, Age: ${input.age}`;
        },
        {
          name: "userTool",
          description: "Process user data",
          schema,
        }
      );

      expectTypeOf(objectTool).toEqualTypeOf<
        DynamicStructuredTool<
          typeof schema,
          { name: string; age: number; email?: string | undefined },
          { name: string; age: number; email?: string | undefined },
          string
        >
      >();

      expectTypeOf(objectTool.invoke({ name: "John", age: 30 })).toEqualTypeOf<
        Promise<string>
      >();
    });

    it("should support custom output types", () => {
      interface ProcessingResult {
        success: boolean;
        data: { processed: string };
      }

      const customOutputTool = tool<z.ZodString, ProcessingResult>(
        async (input) => ({
          success: true,
          data: { processed: input.toUpperCase() },
        }),
        {
          name: "processor",
          description: "Process with custom output",
          schema: z.string(),
        }
      );

      expectTypeOf(customOutputTool.invoke("test")).toEqualTypeOf<
        Promise<ProcessingResult>
      >();
    });

    it("should work with z4 (v4) schemas", () => {
      const v4Schema = z4.object({
        value: z4.string(),
      });

      const v4Tool = tool(
        async (input) => {
          expectTypeOf(input).toEqualTypeOf<{ value: string }>();
          return input.value;
        },
        {
          name: "v4Tool",
          description: "Tool with v4 schema",
          schema: v4Schema,
        }
      );

      expectTypeOf(v4Tool.invoke({ value: "test" })).toEqualTypeOf<
        Promise<string>
      >();
    });

    it("should support JSON schema", () => {
      const jsonSchema: JSONSchema = {
        type: "object",
        properties: {
          message: { type: "string" },
          priority: { type: "number" },
        },
        required: ["message"],
      };

      const jsonTool = tool(
        async (input) => {
          // With JSON schema, input is any
          expectTypeOf(input).toEqualTypeOf<unknown>();
          return "test";
        },
        {
          name: "jsonTool",
          description: "Tool with JSON schema",
          schema: jsonSchema,
        }
      );

      expectTypeOf(jsonTool.invoke({ message: "Hello" })).toEqualTypeOf<
        Promise<string>
      >();
    });
  });

  describe("ToolCall handling", () => {
    it("should return ToolMessage when ToolCall has id", () => {
      const myTool = tool(async (input) => `Result: ${input}`, {
        name: "myTool",
        description: "Test tool",
        schema: z.string(),
      });

      const toolCallWithId: ToolCall = {
        name: "myTool",
        args: { input: "test" },
        id: "123",
        type: "tool_call",
      };

      expectTypeOf(myTool.invoke(toolCallWithId)).toEqualTypeOf<
        Promise<ToolMessage>
      >();
    });
  });

  describe("StructuredTool inheritance", () => {
    it("should properly type custom StructuredTool subclasses", () => {
      const schema = z.object({
        x: z.number(),
        y: z.number(),
      });

      class CalculatorTool extends StructuredTool<
        typeof schema,
        z.output<typeof schema>,
        z.input<typeof schema>,
        { sum: number; product: number }
      > {
        name = "calculator";
        description = "Performs calculations";
        schema = schema;

        async _call(input: z.output<typeof schema>) {
          expectTypeOf(input).toEqualTypeOf<{ x: number; y: number }>();
          return {
            sum: input.x + input.y,
            product: input.x * input.y,
          };
        }
      }

      const calc = new CalculatorTool();

      expectTypeOf(calc.invoke({ x: 5, y: 3 })).toEqualTypeOf<
        Promise<{ sum: number; product: number }>
      >();
    });
  });

  describe("ResponseFormat types", () => {
    it("should handle content_and_artifact response format", () => {
      const artifactTool = tool(
        async () => ["Content", { data: "artifact" }] as const,
        {
          name: "artifactTool",
          description: "Returns content and artifact",
          schema: z.string(),
          responseFormat: "content_and_artifact",
        }
      );

      // The return type should still be string (the content part)
      expectTypeOf(artifactTool.invoke("test")).toEqualTypeOf<
        Promise<
          readonly [
            "Content",
            {
              readonly data: "artifact";
            }
          ]
        >
      >();
    });
  });

  describe("Config parameter types", () => {
    it("should accept proper config types", () => {
      const configTool = tool(
        async (input, config) => {
          expectTypeOf(config).toMatchTypeOf<ToolRunnableConfig | undefined>();
          return input;
        },
        {
          name: "configTool",
          description: "Tool with config",
          schema: z.string(),
        }
      );

      const validConfig: ToolRunnableConfig = {
        tags: ["test"],
        metadata: { key: "value" },
        callbacks: undefined,
        runName: "testRun",
        configurable: { custom: "value" },
      };

      expectTypeOf(configTool.invoke("test", validConfig)).toEqualTypeOf<
        Promise<string>
      >();
    });
  });

  describe("Error scenarios", () => {
    it("should type check invalid inputs at compile time", async () => {
      const strictTool = tool(async (input) => input.value, {
        name: "strict",
        description: "Strict typing",
        schema: z.object({ value: z.string() }),
      });

      // Valid input
      await strictTool.invoke({ value: "test" });

      // @ts-expect-error - missing required field
      await strictTool.invoke({});

      // @ts-expect-error - wrong type
      await strictTool.invoke({ value: 123 });

      // extra fields are possible, though not allowed
      // we can't restrict this due to generic extends constraints in TypeScript
      await strictTool.invoke({ value: "test", extra: "field" });

      // @ts-expect-error - wrong input type entirely
      await strictTool.invoke("string");
    });
  });
});
