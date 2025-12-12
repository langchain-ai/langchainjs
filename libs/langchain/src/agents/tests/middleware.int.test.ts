import { z } from "zod";
import { describe, it, expect, expectTypeOf } from "vitest";
import { createAgent, createMiddleware } from "../index.js";

describe("afterAgent hook", () => {
  it("should allow to modify structured output generated via provider strategy", async () => {
    const structuredOutputMiddleware = createMiddleware({
      name: "structuredOutputMiddleware",
      afterAgent: (state) => {
        expectTypeOf(state.structuredResponse).toEqualTypeOf<
          Record<string, unknown> | undefined
        >();
        return {
          ...state,
          structuredResponse: {
            name: "Jane Doe",
            age: 39,
          },
        };
      },
    });
    const agent = createAgent({
      model: "openai:gpt-4o-mini",
      middleware: [structuredOutputMiddleware],
      responseFormat: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    const result = await agent.invoke({
      messages: "Extract the following text: Max Mustermann is 42 years old",
    });
    expect(result.structuredResponse.name).toBe("Jane Doe");
    expect(result.structuredResponse.age).toBe(39);
  });
});
