import { expect, describe, it } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { z } from "zod";

import { createAgent, createMiddleware } from "../index.js";
import { FakeToolCallingChatModel } from "./utils.js";

describe("middleware", () => {
  it("should propagate state schema to middleware hooks and result", async () => {
    const prompt = new HumanMessage("What is the weather in Tokyo?");
    const initialState = {
      messages: [prompt],
      middlewareABeforeModelState: "ABefore",
      middlewareAAfterModelState: "AAfter",
      middlewareBBeforeModelState: "BBefore",
      middlewareBAfterModelState: "BAfter",
      middlewareCBeforeModelState: "CBefore",
      middlewareCAfterModelState: "CAfter",
    };
    const llm = new FakeToolCallingChatModel({
      responses: [new AIMessage("The weather in Tokyo is 25°C")],
    });
    const middlewareA = createMiddleware({
      name: "middlewareA",
      stateSchema: z.object({
        middlewareABeforeModelState: z.string(),
        middlewareAAfterModelState: z.string(),
      }),
      beforeModel: (state) => {
        expect(state).toEqual(initialState);
        return {
          middlewareABeforeModelState: "middlewareABeforeModelState",
        };
      },
      afterModel: (state) => {
        const { messages, ...rest } = state;
        const { messages: _, ...restOriginal } = initialState;
        expect(rest).toEqual(
          expect.objectContaining({
            ...restOriginal,
            middlewareABeforeModelState: "middlewareABeforeModelState",
            middlewareBBeforeModelState: "middlewareBBeforeModelState",
            middlewareCAfterModelState: "middlewareCAfterModelState",
          })
        );
        return {
          middlewareAAfterModelState: "middlewareAAfterModelState",
        };
      },
    });
    const middlewareB = createMiddleware({
      name: "middlewareB",
      stateSchema: z.object({
        middlewareBBeforeModelState: z.string(),
        middlewareBAfterModelState: z.string(),
      }),
      beforeModel: (state) => {
        expect(state).toEqual({
          ...initialState,
          middlewareABeforeModelState: "middlewareABeforeModelState",
        });
        return {
          middlewareBBeforeModelState: "middlewareBBeforeModelState",
        };
      },
    });
    const middlewareC = createMiddleware({
      name: "middlewareC",
      stateSchema: z.object({
        middlewareCBeforeModelState: z.string(),
        middlewareCAfterModelState: z.string(),
      }),
      afterModel: (state) => {
        const { messages, ...rest } = state;
        expect(rest).toEqual({
          middlewareAAfterModelState: "AAfter",
          middlewareABeforeModelState: "middlewareABeforeModelState",
          middlewareBAfterModelState: "BAfter",
          middlewareBBeforeModelState: "middlewareBBeforeModelState",
          middlewareCAfterModelState: "CAfter",
          middlewareCBeforeModelState: "CBefore",
        });
        return {
          middlewareCAfterModelState: "middlewareCAfterModelState",
        };
      },
    });
    const agent = createAgent({
      llm,
      tools: [],
      middlewares: [middlewareA, middlewareB, middlewareC] as const,
    });

    const result = await agent.invoke(initialState);

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

  it("should propagate context schema to middleware hooks", async () => {
    const llm = new FakeToolCallingChatModel({
      responses: [new AIMessage("The weather in Tokyo is 25°C")],
    });
    const middleware = createMiddleware({
      name: "middleware",
      contextSchema: z.object({
        customMiddlewareContext: z.string(),
        customMiddlewareContext2: z.number().default(42),
      }),

      beforeModel: (_, { context }) => {
        expect(context).toEqual({
          customMiddlewareContext: "customMiddlewareContext",
          customMiddlewareContext2: 42,
        });
      },
      afterModel: (_, { context }) => {
        expect(context).toEqual({
          customMiddlewareContext: "customMiddlewareContext",
          customMiddlewareContext2: 42,
        });
      },
    });

    const agent = createAgent({
      llm,
      tools: [],
      contextSchema: z.object({
        customContext: z.string(),
        customContext2: z.number().default(42),
      }),
      middlewares: [middleware] as const,
    });

    await agent.invoke(
      {
        messages: [new HumanMessage("Hello, world!")],
      },
      {
        context: {
          customMiddlewareContext: "customMiddlewareContext",
          customContext: "customContext",
        },
      }
    );
  });
});
