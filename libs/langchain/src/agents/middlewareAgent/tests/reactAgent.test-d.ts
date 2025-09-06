import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import { describe, it } from "vitest";

import { createAgent } from "../index.js";

describe("reactAgent", () => {
  it("should not require runnable config if context schema is not provided", async () => {
    const agent = createAgent({
      tools: [],
    });
    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });
  });

  it("should allow a context schema that makes invoke calls require to pass in a context", async () => {
    const agent = createAgent({
      tools: [],
      contextSchema: z.object({
        customRequiredContextProp: z.string(),
        customOptionalContextProp: z.string().default("default value"),
      }),
    });

    const state = {
      messages: [new HumanMessage("Hello, world!")],
    };
    await agent.invoke(state, {
      context: {
        customRequiredContextProp: "123",
      },
    });
    await agent.invoke(state, {
      context: {
        // @ts-expect-error defined as string
        customRequiredContextProp: 123,
      },
    });

    await agent.invoke(state, {
      context: {
        customRequiredContextProp: "123",
        // @ts-expect-error defined as string
        customOptionalContextProp: 456,
      },
    });
  });
});
