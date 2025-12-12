import { z } from "zod/v3";
import { describe, it, expectTypeOf } from "vitest";

import { tool } from "../index.js";
import type { ToolRuntime } from "../types.js";
import type { RunnableConfig } from "../../runnables/config.js";

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
