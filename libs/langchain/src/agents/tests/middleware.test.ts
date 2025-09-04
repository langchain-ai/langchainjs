import { expect, describe, it } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { z } from "zod";

import { createAgent, createMiddleware } from "../index.js";
import { FakeToolCallingChatModel } from "./utils.js";

const middlewareA = createMiddleware({
  name: "middlewareA",
  stateSchema: z.object({
    middlewareABeforeModelState: z.string(),
    middlewareAAfterModelState: z.string(),
  }),
  beforeModel: () => ({
    middlewareABeforeModelState: "middlewareABeforeModelState",
  }),
  afterModel: () => ({
    middlewareAAfterModelState: "middlewareAAfterModelState",
  }),
});
const middlewareB = createMiddleware({
  name: "middlewareB",
  stateSchema: z.object({
    middlewareBBeforeModelState: z.string(),
    middlewareBAfterModelState: z.string(),
  }),
  beforeModel: () => ({
    middlewareBBeforeModelState: "middlewareBBeforeModelState",
  }),
});
const middlewareC = createMiddleware({
  name: "middlewareC",
  stateSchema: z.object({
    middlewareCBeforeModelState: z.string(),
    middlewareCAfterModelState: z.string(),
  }),
  afterModel: () => ({
    middlewareCAfterModelState: "middlewareCAfterModelState",
  }),
});

describe("middleware", () => {
  it("should propagate state schema to the result and recognize default values", async () => {
    const llm = new FakeToolCallingChatModel({
      responses: [new AIMessage("The weather in Tokyo is 25°C")],
    });
    const agent = createAgent({
      llm,
      tools: [],
      middlewares: [middlewareA, middlewareB, middlewareC] as const,
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("What is the weather in Tokyo?")],
      middlewareABeforeModelState: "ABefore",
      middlewareAAfterModelState: "AAfter",
      middlewareBBeforeModelState: "BBefore",
      middlewareBAfterModelState: "BAfter",
      middlewareCBeforeModelState: "CBefore",
      middlewareCAfterModelState: "CAfter",
    });

    // overwritten by middlewareA beforeModel hook
    expect(result.middlewareABeforeModelState).toBe(
      "middlewareABeforeModelState"
    );
    // overwritten by middlewareA afterModel hook
    expect(result.middlewareAAfterModelState).toBe(
      "middlewareAAfterModelState"
    );
    // overwritten by middlewareA beforeModel hook
    expect(result.middlewareBBeforeModelState).toBe(
      "middlewareBBeforeModelState"
    );
    // not overwritten by middlewareB beforeModel hook
    expect(result.middlewareBAfterModelState).toBe("BAfter");
    // not overwritten by middlewareC beforeModel hook
    expect(result.middlewareCBeforeModelState).toBe("CBefore");
    // overwritten by middlewareC afterModel hook
    expect(result.middlewareCAfterModelState).toBe(
      "middlewareCAfterModelState"
    );
  });
});
