import { describe, it, expect } from "vitest";
import { z } from "zod/v3";
import { withLangGraph } from "@langchain/langgraph/zod";
import { initializeMiddlewareStates } from "../utils.js";
import type { AgentMiddleware } from "../../middleware/types.js";

describe("initializeMiddlewareStates", () => {
  it("should handle withLangGraph defaults", async () => {
    // Create a middleware with a state schema that has a default
    const middleware: AgentMiddleware = {
      name: "TestMiddleware",
      stateSchema: z.object({
        testField: withLangGraph(z.string(), {
          default: () => "default-value",
        }),
      }),
    };

    // Call with empty state (like the test does)
    const result = await initializeMiddlewareStates([middleware], {});

    // Should apply the default value
    expect(result).toEqual({
      testField: "default-value",
    });
  });

  it("should handle withLangGraph defaults with reducers", async () => {
    // Create a middleware like the text editor middleware
    const middleware: AgentMiddleware = {
      name: "TestMiddleware",
      stateSchema: z.object({
        fieldWithDefault: withLangGraph(z.string(), {
          reducer: {
            fn: (_left: string, right: string) => right,
          },
          default: () => "default value",
        }),
      }),
    };

    // Call with empty state
    const result = await initializeMiddlewareStates([middleware], {});

    // Should apply the default value
    expect(result).toEqual({
      fieldWithDefault: "default value",
    });
  });

  it("should throw error for truly required fields without defaults", async () => {
    // Create a middleware with a required field (no default)
    const middleware: AgentMiddleware = {
      name: "TestMiddleware",
      stateSchema: z.object({
        requiredField: z.string(),
      }),
    };

    // Should throw because field is required and has no default
    await expect(initializeMiddlewareStates([middleware], {})).rejects.toThrow(
      /required/i
    );
  });
});
