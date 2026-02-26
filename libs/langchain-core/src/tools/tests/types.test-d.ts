import { z } from "zod/v3";
import { describe, it, expectTypeOf } from "vitest";

import { tool, DynamicStructuredTool, DynamicTool } from "../index.js";
import type { ToolEventType, ToolRuntime } from "../types.js";
import type { RunnableConfig } from "../../runnables/config.js";

describe("tool() literal name type inference", () => {
  it("should infer literal name type for DynamicStructuredTool", () => {
    const myTool = tool((_input) => "result", {
      name: "mySpecificTool",
      description: "A tool with a specific name",
      schema: z.object({
        query: z.string(),
      }),
    });

    // The name property should be typed as the literal "mySpecificTool"
    expectTypeOf(myTool.name).toEqualTypeOf<"mySpecificTool">();

    // The tool should be a DynamicStructuredTool with the literal name type
    expectTypeOf(myTool).toExtend<
      DynamicStructuredTool<
        z.ZodObject<{ query: z.ZodString }>,
        { query: string },
        { query: string },
        string,
        ToolEventType,
        "mySpecificTool"
      >
    >();
  });

  it("should support discriminated unions of tools by name", () => {
    const searchTool = tool((_input) => "search result", {
      name: "search",
      description: "Search for information",
      schema: z.object({ query: z.string() }),
    });

    const calculatorTool = tool((_input) => "42", {
      name: "calculator",
      description: "Perform calculations",
      schema: z.object({ expression: z.string() }),
    });

    // Each tool in the union should have a distinct literal name type
    expectTypeOf(searchTool.name).toEqualTypeOf<"search">();
    expectTypeOf(calculatorTool.name).toEqualTypeOf<"calculator">();

    // The union discriminates by name
    const tools = [searchTool, calculatorTool];
    const firstTool = tools[0];

    if (firstTool.name === "search") {
      expectTypeOf(firstTool.name).toEqualTypeOf<"search">();
    } else {
      expectTypeOf(firstTool.name).toEqualTypeOf<"calculator">();
    }
  });

  it("should fall back to string type when name is not a literal", () => {
    const dynamicName: string = "dynamicTool";
    const dynamicTool = tool((_input) => "result", {
      name: dynamicName,
      description: "A tool with a dynamic name",
      schema: z.object({ input: z.string() }),
    });

    // When name is typed as string, the name property should be string
    expectTypeOf(dynamicTool.name).toEqualTypeOf<string>();
  });

  it("should preserve literal name type with ToolRuntime", () => {
    const stateSchema = z.object({ userId: z.string() });
    type State = z.infer<typeof stateSchema>;

    const myTool = tool(
      (_input, runtime: ToolRuntime<State>) => {
        return `Hello, ${runtime.state.userId}!`;
      },
      {
        name: "greetUser",
        description: "Greet a user",
        schema: z.object({ greeting: z.string() }),
      }
    );

    // Name should still be inferred as literal even with ToolRuntime
    expectTypeOf(myTool.name).toEqualTypeOf<"greetUser">();
  });
});

describe("tool() async generator type inference", () => {
  it("should infer ToolEventT for DynamicStructuredTool with ZodObject schema", () => {
    const streamingTool = tool(
      async function* (_input) {
        yield { progress: 50 };
        return "done";
      },
      {
        name: "streamingTool",
        description: "A streaming tool",
        schema: z.object({ query: z.string() }),
      }
    );

    expectTypeOf(streamingTool).toBeObject();
    expectTypeOf(streamingTool.name).toEqualTypeOf<"streamingTool">();

    expectTypeOf(streamingTool).toExtend<
      DynamicStructuredTool<
        z.ZodObject<{ query: z.ZodString }>,
        { query: string },
        { query: string },
        string,
        { progress: number },
        "streamingTool"
      >
    >();
  });

  it("should infer ToolEventT for DynamicTool with ZodString schema", () => {
    const streamingTool = tool(
      async function* (_input) {
        yield { status: "working" };
        return "result";
      },
      {
        name: "stringStreamingTool",
        description: "A streaming string tool",
        schema: z.string(),
      }
    );

    expectTypeOf(streamingTool).toExtend<
      DynamicTool<string, { status: string }>
    >();
  });

  it("should default ToolEventT to unknown for non-generator tools", () => {
    const regularTool = tool(async (_input) => "result", {
      name: "regularTool",
      description: "A regular tool",
      schema: z.object({ query: z.string() }),
    });

    expectTypeOf(regularTool).toExtend<
      DynamicStructuredTool<
        z.ZodObject<{ query: z.ZodString }>,
        { query: string },
        { query: string },
        string,
        ToolEventType,
        "regularTool"
      >
    >();
  });
});

describe("ToolRuntime", () => {
  it("allows to define runnable config argument as ToolRuntime", () => {
    const stateSchema = z.object({
      userId: z.string(),
    });
    const contextSchema = z.object({
      db: z.object({
        foo: z.string(),
      }),
    });

    type State = z.infer<typeof stateSchema>;
    type Context = z.infer<typeof contextSchema>;

    tool(
      (
        input,
        runtime: ToolRuntime<typeof stateSchema, typeof contextSchema>
      ) => {
        expectTypeOf(input).toEqualTypeOf<{
          some: string;
        }>();
        expectTypeOf(runtime.state).toEqualTypeOf<State>();
        expectTypeOf(runtime.context).toEqualTypeOf<Context>();
        expectTypeOf(runtime.toolCallId).toEqualTypeOf<string>();
        expectTypeOf(runtime.config).toMatchTypeOf<RunnableConfig>();
        return `Hello, ${runtime.state.userId}!`;
      },
      {
        name: "test",
        description: "test",
        schema: z.object({
          some: z.string(),
        }),
      }
    );

    tool(
      (input, runtime: ToolRuntime<State, Context>) => {
        expectTypeOf(input).toEqualTypeOf<{
          some: string;
        }>();
        expectTypeOf(runtime.state).toEqualTypeOf<State>();
        expectTypeOf(runtime.context).toEqualTypeOf<Context>();
        expectTypeOf(runtime.toolCallId).toEqualTypeOf<string>();
        expectTypeOf(runtime.config).toMatchTypeOf<RunnableConfig>();
        return `Hello, ${runtime.state.userId}!`;
      },
      {
        name: "test",
        description: "test",
        schema: z.object({
          some: z.string(),
        }),
      }
    );
  });
});
