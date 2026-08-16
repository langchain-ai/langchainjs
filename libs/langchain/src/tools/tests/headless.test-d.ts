import { z as z3 } from "zod/v3";
import { z as z4 } from "zod/v4";
import { expectTypeOf, it, describe } from "vitest";
import { tool } from "../headless.js";
import type { DynamicStructuredTool } from "@langchain/core/tools";

describe("tool — headless overload", () => {
  it("zod v3: should infer arg types from schema and preserve name literal", async () => {
    const myTool = tool({
      name: "test",
      description: "test",
      schema: z3.object({
        message: z3.string(),
      }),
    });

    expectTypeOf(myTool.name).toEqualTypeOf<"test">();

    const impl = myTool.implement(async (args) => {
      expectTypeOf(args).toEqualTypeOf<{ message: string }>();
      return { output: "test" };
    });

    expectTypeOf(impl.tool.name).toEqualTypeOf<"test">();
    expectTypeOf(impl.execute).toMatchTypeOf<
      (args: { message: string }) => Promise<{ output: string }>
    >();
  });

  it("zod v4: should infer arg types from schema and preserve name literal", async () => {
    const myTool = tool({
      name: "test",
      description: "test",
      schema: z4.object({
        message: z4.string(),
      }),
    });

    expectTypeOf(myTool.name).toEqualTypeOf<"test">();

    const impl = myTool.implement(async (args) => {
      expectTypeOf(args).toEqualTypeOf<{ message: string }>();
      return { output: "test" };
    });

    expectTypeOf(impl.tool.name).toEqualTypeOf<"test">();
    expectTypeOf(impl.execute).toMatchTypeOf<
      (args: { message: string }) => Promise<{ output: string }>
    >();
  });
});

describe("tool — normal overload", () => {
  it("zod v3: should return DynamicStructuredTool with proper types", () => {
    const myTool = tool(
      async ({ city }: { city: string }) => `Weather in ${city}`,
      {
        name: "get_weather",
        description: "Get the weather",
        schema: z3.object({ city: z3.string() }),
      }
    );

    expectTypeOf(myTool).toExtend<DynamicStructuredTool>();
    expectTypeOf(myTool.name).toEqualTypeOf<"get_weather">();
  });

  it("zod v4: should return DynamicStructuredTool with proper types", () => {
    const myTool = tool(
      async ({ city }: { city: string }) => `Weather in ${city}`,
      {
        name: "get_weather",
        description: "Get the weather",
        schema: z4.object({ city: z4.string() }),
      }
    );

    expectTypeOf(myTool).toExtend<DynamicStructuredTool>();
    expectTypeOf(myTool.name).toEqualTypeOf<"get_weather">();
  });
});
