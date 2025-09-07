import { z } from "zod";
import { describe, it, expect } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { createMiddleware, createAgent } from "../index.js";

import { FakeToolCallingModel } from "../../tests/utils.js";

describe("middleware state management", () => {
  it("should allow to define private state props with _ that doesn't leak out", async () => {
    expect.assertions(10);
    const llm = new FakeToolCallingModel({});

    /**
     * Middleware A defines
     * - beforeModel
     * - afterModel
     */
    const middlewareA = createMiddleware({
      name: "middlewareA",
      stateSchema: z.object({
        middlewareABeforeModelState: z.string(),
        middlewareAAfterModelState: z.string(),
        _privateMiddlewareAState: z.string(),
      }),
      beforeModel: async (state) => {
        // ensure built-in state is present
        expect(state).toHaveProperty("messages");

        const { messages, ...rest } = state;
        expect(rest).toEqual({
          middlewareABeforeModelState: "ABefore",
          middlewareAAfterModelState: "AAfter",
        });
        return {
          middlewareABeforeModelState: "middlewareABeforeModelState",
          _privateMiddlewareAState: "privateMiddlewareAState",
        };
      },
      afterModel: async (state) => {
        // ensure built-in state is present
        expect(state).toHaveProperty("messages");

        const { messages, ...rest } = state;
        expect(rest).toEqual({
          middlewareABeforeModelState: "middlewareABeforeModelState",
          middlewareAAfterModelState: "AAfter",
          _privateMiddlewareAState: "privateMiddlewareAState",
        });
        return {
          middlewareAAfterModelState: "middlewareAAfterModelState",
          _privateMiddlewareAState: "privateMiddlewareAState",
        };
      },
    });

    /**
     * Middleware B defines
     * - beforeModel
     */
    const middlewareB = createMiddleware({
      name: "middlewareB",
      stateSchema: z.object({
        middlewareBBeforeModelState: z.string(),
        middlewareBAfterModelState: z.string(),
        _privateMiddlewareBState: z.string(),
      }),
      beforeModel: async (state) => {
        // ensure built-in state is present
        expect(state).toHaveProperty("messages");

        const { messages, ...rest } = state;
        expect(rest).toEqual({
          middlewareBBeforeModelState: "BBefore",
          middlewareBAfterModelState: "BAfter",
        });
        return {
          middlewareBBeforeModelState: "middlewareBBeforeModelState",
          _privateMiddlewareBState: "privateMiddlewareBState",
        };
      },
    });

    /**
     * Middleware C defines
     * - afterModel
     */
    const middlewareC = createMiddleware({
      name: "middlewareC",
      stateSchema: z.object({
        middlewareCBeforeModelState: z.string(),
        middlewareCAfterModelState: z.string(),
        _privateMiddlewareCState: z.string(),
      }),
      afterModel: async (state) => {
        // ensure built-in state is present
        expect(state).toHaveProperty("messages");

        const { messages, ...rest } = state;
        expect(rest).toEqual({
          middlewareCBeforeModelState: "CBefore",
          middlewareCAfterModelState: "CAfter",
        });
        return {
          middlewareCAfterModelState: "middlewareCAfterModelState",
          _privateMiddlewareCState: "privateMiddlewareCState",
        };
      },
    });

    const agent = createAgent({
      llm,
      middlewares: [middlewareA, middlewareB, middlewareC] as const,
    });

    const { messages, ...rest } = await agent.invoke({
      messages: [new HumanMessage("What is the weather in Tokyo?")],
      middlewareABeforeModelState: "ABefore",
      middlewareAAfterModelState: "AAfter",
      middlewareBBeforeModelState: "BBefore",
      middlewareBAfterModelState: "BAfter",
      middlewareCBeforeModelState: "CBefore",
      middlewareCAfterModelState: "CAfter",
    });

    expect(messages).toHaveLength(2);
    expect(rest).toEqual({
      middlewareABeforeModelState: "middlewareABeforeModelState",
      middlewareAAfterModelState: "middlewareAAfterModelState",
      middlewareBBeforeModelState: "middlewareBBeforeModelState",
      middlewareBAfterModelState: "BAfter",
      middlewareCBeforeModelState: "CBefore",
      middlewareCAfterModelState: "middlewareCAfterModelState",
    });
  });
});
