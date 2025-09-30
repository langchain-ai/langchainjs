import { z } from "zod/v3";
import { HumanMessage } from "@langchain/core/messages";
import { LanguageModelLike } from "@langchain/core/language_models/base";
import { describe, it, expectTypeOf } from "vitest";

import { createAgent } from "../index.js";

describe("reactAgent", () => {
  it("should require model as only required property", async () => {
    // Verify that passing only model is valid
    createAgent({ model: "openai:gpt-4" });

    // @ts-expect-error model is required
    createAgent({});

    // Verify model property type
    expectTypeOf<Parameters<typeof createAgent>[0]>()
      .toHaveProperty("model")
      .toEqualTypeOf<string | LanguageModelLike>();
  });

  it("should not require runnable config if context schema is not provided", async () => {
    const agent = createAgent({
      model: "openai:gpt-4",
    });
    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });
  });

  it("should allow a context schema that makes invoke calls require to pass in a context", async () => {
    const agent = createAgent({
      model: "openai:gpt-4",
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

  it("verify input types", async () => {
    const agent = createAgent({
      model: "openai:gpt-4",
    });

    // invoke
    await agent.invoke({
      messages: [{ role: "user", content: "Hello, world!" }],
    });
    await agent.invoke({
      messages: ["Hello, world!"],
    });
    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });
    await agent.invoke({
      messages: { role: "user", content: "Hello, world!" },
    });
    await agent.invoke({
      messages: "Hello, world!",
    });
    await agent.invoke({
      messages: new HumanMessage("Hello, world!"),
    });

    // stream
    await agent.stream({
      messages: [{ role: "user", content: "Hello, world!" }],
    });
    await agent.stream({
      messages: ["Hello, world!"],
    });
    await agent.stream({
      messages: [new HumanMessage("Hello, world!")],
    });
    await agent.stream({
      messages: { role: "user", content: "Hello, world!" },
    });
    await agent.stream({
      messages: "Hello, world!",
    });
    await agent.stream({
      messages: new HumanMessage("Hello, world!"),
    });
  });
});
