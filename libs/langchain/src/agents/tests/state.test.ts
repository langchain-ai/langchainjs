import { z } from "zod/v3";
import { describe, it, expect } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph-checkpoint";

import { createMiddleware, createAgent } from "../index.js";
import { FakeToolCallingModel } from "./utils.js";

const checkpointer = new MemorySaver();
const config = {
  configurable: {
    thread_id: "test-123",
  },
};

describe("middleware state management", () => {
  it("should allow to define private state props with _ that doesn't leak out", async () => {
    expect.assertions(10);
    const model = new FakeToolCallingModel({});

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
      model,
      middleware: [middlewareA, middlewareB, middlewareC] as const,
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

  it("should track thread level call count and run model call count as part of a private state", async () => {
    expect.assertions(9);
    const model = new FakeToolCallingModel({});
    const middleware = createMiddleware({
      name: "middleware",
      beforeModel: async (_, runtime) => {
        expect(runtime.threadLevelCallCount).toBe(0);
        expect(runtime.runModelCallCount).toBe(0);

        /**
         * try to override the private state
         */
        return {
          _privateState: {
            threadLevelCallCount: 123,
            runModelCallCount: 123,
          },
        };
      },
      wrapModelCall: async (request, handler) => {
        expect(request.runtime.threadLevelCallCount).toBe(0);
        expect(request.runtime.runModelCallCount).toBe(0);
        return handler(request);
      },
      afterModel: async (_, runtime) => {
        expect(runtime.threadLevelCallCount).toBe(1);
        expect(runtime.runModelCallCount).toBe(1);

        /**
         * try to override the private state
         */
        return {
          _privateState: {
            threadLevelCallCount: 123,
            runModelCallCount: 123,
          },
        };
      },
    });

    const agent = createAgent({
      model,
      middleware: [middleware] as const,
      checkpointer,
    });

    const result = await agent.invoke(
      {
        messages: [new HumanMessage("What is the weather in Tokyo?")],
      },
      config
    );

    // @ts-expect-error should not be defined in the state
    expect(result.threadLevelCallCount).toBe(undefined);
    // @ts-expect-error should not be defined in the state
    expect(result.runModelCallCount).toBe(undefined);
    // @ts-expect-error should not be defined in the state
    expect(result._privateState).toBe(undefined);
  });

  it("should allow to continue counting thread level call count and run model call count across multiple invocations", async () => {
    expect.assertions(6);
    const model = new FakeToolCallingModel({});
    const middleware = createMiddleware({
      name: "middleware",
      beforeModel: async (_, runtime) => {
        expect(runtime.threadLevelCallCount).toBe(1);
        expect(runtime.runModelCallCount).toBe(0);
      },
      wrapModelCall: async (request, handler) => {
        expect(request.runtime.threadLevelCallCount).toBe(1);
        expect(request.runtime.runModelCallCount).toBe(0);
        return handler(request);
      },
      afterModel: async (_, runtime) => {
        expect(runtime.threadLevelCallCount).toBe(2);
        expect(runtime.runModelCallCount).toBe(1);
      },
    });

    const agent = createAgent({
      model,
      middleware: [middleware] as const,
      checkpointer,
    });

    await agent.invoke(
      {
        messages: [new HumanMessage("What is the weather in Tokyo?")],
      },
      config
    );
  });
});
