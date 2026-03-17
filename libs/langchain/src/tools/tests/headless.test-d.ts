import { z as z3 } from "zod/v3";
import { z as z4 } from "zod/v4";
import { expectTypeOf, it, describe } from "vitest";
import { tool } from "../headless.js";

describe("tool (headless)", () => {
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
