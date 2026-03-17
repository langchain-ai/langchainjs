import { z as z3 } from "zod/v3";
import { z as z4 } from "zod/v4";
import { expectTypeOf, it, describe } from "vitest";
import { browserTool } from "../browser.js";

describe("browserTool", () => {
  it("zod v3: should create a tool with correct properties", async () => {
    const tool = browserTool(
      async (args) => {
        expectTypeOf(args).toEqualTypeOf<{
          message: string;
        }>();
        return {
          output: "test",
        };
      },
      {
        name: "test",
        description: "test",
        schema: z3.object({
          message: z3.string(),
        }),
      }
    );

    expectTypeOf(tool.name).toEqualTypeOf<"test">();
    const result = await tool.invoke({
      message: "test",
    });

    expectTypeOf(result).toEqualTypeOf<{
      output: string;
    }>();
  });

  it("zod v4: should create a tool with correct properties", async () => {
    const tool = browserTool(
      async (args) => {
        expectTypeOf(args).toEqualTypeOf<{
          message: string;
        }>();
        return {
          output: "test",
        };
      },
      {
        name: "test",
        description: "test",
        schema: z4.object({
          message: z4.string(),
        }),
      }
    );

    expectTypeOf(tool.name).toEqualTypeOf<"test">();
    const result = await tool.invoke({
      message: "test",
    });

    expectTypeOf(result).toEqualTypeOf<{
      output: string;
    }>();
  });
});
