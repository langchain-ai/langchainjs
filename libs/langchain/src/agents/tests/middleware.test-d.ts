import { describe, it, expectTypeOf } from "vitest";
import { z } from "zod";

import { createAgent, createMiddleware } from "../index.js";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";

describe("middleware types", () => {
  it("a middleware can define a state schema which is propagated to the result", async () => {
    const middleware = createMiddleware({
      name: "Middleware",
      stateSchema: z.object({
        customStateProp: z.string().default("default value"),
        customRequiredStateProp: z.string(),
        customRequiredStateProp2: z.string(),
      }),
    });

    const middleware2 = createMiddleware({
      name: "Middleware2",
      stateSchema: z.object({
        customStateProp2: z.string().default("default value 2"),
      }),
    });

    const agent = createAgent({
      middlewares: [middleware, middleware2] as const,
      tools: [],
      model: "gpt-4",
      responseFormat: z.object({
        customResponseFormat: z.string(),
      }),
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
      customRequiredStateProp: "123",
      // @ts-expect-error not defined in any middleware state
      foo: "bar",
    });

    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
      customRequiredStateProp: "123",
      // @ts-expect-error invalid type
      customRequiredStateProp2: 456,
    });

    // Verify the result has the expected properties
    expectTypeOf(result).toHaveProperty("customStateProp");
    expectTypeOf(result).toHaveProperty("customStateProp2");
    expectTypeOf(result).toHaveProperty("messages");
    expectTypeOf(result).toHaveProperty("structuredResponse");

    // Verify the types of individual properties
    expectTypeOf(result.customStateProp).toBeString();
    expectTypeOf(result.customStateProp2).toBeString();
    expectTypeOf(result.messages).toEqualTypeOf<BaseMessage[]>();
    expectTypeOf(result.structuredResponse).toEqualTypeOf<{
      customResponseFormat: string;
    }>();
  });
});
