import { z } from "zod/v3";
import { describe, it, expectTypeOf } from "vitest";
import { tool, type DynamicStructuredTool } from "@langchain/core/tools";

import { createMiddleware } from "../middleware.js";
import { createAgent } from "../index.js";
import type { InferAgentTools } from "../types.js";

describe("tools", () => {
  it("should allow to infer tool types from agent primitive", () => {
    const tool1 = tool(
      async (input) => {
        return {
          returnValue: input.value,
        };
      },
      {
        name: "tool1",
        description: "Tool 1",
        schema: z.object({
          value: z.string(),
        }),
      }
    );

    const tool2 = tool(
      async (input) => {
        return {
          anotherReturnValue: input.anotherValue,
        };
      },
      {
        name: "tool2",
        description: "Tool 2",
        schema: z.object({
          anotherValue: z.boolean(),
        }),
      }
    );

    const tool3 = tool(
      async (input) => {
        return {
          middlewareReturnValue: input.middlewareValue,
        };
      },
      {
        name: "tool3",
        description: "Tool 3",
        schema: z.object({
          middlewareValue: z.number(),
        }),
      }
    );

    const middleware = createMiddleware({
      name: "middleware",
      tools: [tool3],
    });

    const agent = createAgent({
      tools: [tool1, tool2],
      middleware: [middleware],
      model: "gpt-4",
      responseFormat: z.object({
        value: z.string(),
        anotherValue: z.boolean(),
      }),
    });

    type AgentTools = InferAgentTools<typeof agent>;

    // Verify individual tool types are preserved at specific indices
    type FirstTool = AgentTools[0];
    type SecondTool = AgentTools[1];
    type ThirdTool = AgentTools[2];

    // First tool should be exactly tool1's type
    expectTypeOf<FirstTool>().toEqualTypeOf<typeof tool1>();

    // Second tool should be exactly tool2's type
    expectTypeOf<SecondTool>().toEqualTypeOf<typeof tool2>();

    // Verify tool1 has the correct schema and return types
    expectTypeOf<FirstTool>().toExtend<
      DynamicStructuredTool<
        z.ZodObject<{ value: z.ZodString }>,
        { value: string },
        { value: string },
        { returnValue: string }
      >
    >();

    // Verify tool2 has the correct schema and return types
    expectTypeOf<SecondTool>().toExtend<
      DynamicStructuredTool<
        z.ZodObject<{ anotherValue: z.ZodBoolean }>,
        { anotherValue: boolean },
        { anotherValue: boolean },
        { anotherReturnValue: boolean }
      >
    >();

    // Verify tool3 has the correct schema and return types (from middleware)
    expectTypeOf<ThirdTool>().toExtend<
      DynamicStructuredTool<
        z.ZodObject<{ middlewareValue: z.ZodNumber }>,
        { middlewareValue: number },
        { middlewareValue: number },
        { middlewareReturnValue: number }
      >
    >();
  });
});
