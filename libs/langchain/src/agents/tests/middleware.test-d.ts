import { describe, it, expectTypeOf } from "vitest";
import { z } from "zod/v3";
import { HumanMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";

import { createAgent, createMiddleware } from "../index.js";
import type { ServerTool, ClientTool } from "../tools.js";

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
      middleware: [middleware, middleware2] as const,
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

  describe("context schema", () => {
    it("a middleware can define a context schema which can be a required property within the runnable config", async () => {
      const middleware = createMiddleware({
        name: "Middleware",
        contextSchema: z.object({
          customOptionalContextProp: z.string().default("default value"),
          customRequiredContextProp: z.string(),
        }),
      });

      const agent = createAgent({
        contextSchema: z.object({
          customAgentOptionalContextProp: z.string().default("default value"),
          customAgentRequiredContextProp: z.string(),
        }),
        middleware: [middleware] as const,
        tools: [],
        model: "gpt-4",
      });

      const state = {
        messages: [new HumanMessage("Hello, world!")],
      };

      await agent.invoke(state, {
        context: {
          customAgentRequiredContextProp: "123",
          customRequiredContextProp: "456",
        },
      });

      await agent.invoke(state, {
        context: {
          customAgentRequiredContextProp: "123",
          // @ts-expect-error defined as string
          customRequiredContextProp: 456,
        },
      });
    });

    it("is required to pass in a context if a middleware has context schema that is not optional", async () => {
      const middleware = createMiddleware({
        name: "Middleware",
        contextSchema: z.object({
          customRequiredContextProp: z.string(),
        }),
      });

      const agent = createAgent({
        middleware: [middleware] as const,
        tools: [],
        model: "gpt-4",
      });

      await agent.invoke(
        {
          messages: [new HumanMessage("Hello, world!")],
        },
        // @ts-expect-error Property 'context' is missing
        {
          configurable: {
            thread_id: "test-123",
          },
        }
      );
    });

    it("doesn't require users to pass in a context if a middleware has optional context schema", async () => {
      const middleware = createMiddleware({
        name: "Middleware",
        contextSchema: z
          .object({
            customOptionalContextProp: z.string().default("default value"),
          })
          .optional(),
      });

      const agent = createAgent({
        middleware: [middleware] as const,
        tools: [],
        model: "gpt-4",
      });

      await agent.invoke(
        {
          messages: [new HumanMessage("Hello, world!")],
        },
        {
          configurable: {
            thread_id: "test-123",
          },
        }
      );
    });

    it("doesn't require users to pass in a context if a middleware has context schema with defaults", async () => {
      const middleware = createMiddleware({
        name: "Middleware",
        contextSchema: z
          .object({
            customDefaultContextProp: z.string().default("default value"),
            customOptionalContextProp: z.string().optional(),
            customRequiredContextProp: z.string(),
          })
          .default({
            customRequiredContextProp: "default value",
          }),
        beforeModel: async (_state, runtime) => {
          expectTypeOf(runtime.context).toEqualTypeOf<{
            customDefaultContextProp: string;
            customOptionalContextProp?: string;
            customRequiredContextProp: string;
          }>();
        },
        afterModel: async (_state, runtime) => {
          expectTypeOf(runtime.context).toEqualTypeOf<{
            customDefaultContextProp: string;
            customOptionalContextProp?: string;
            customRequiredContextProp: string;
          }>();
        },
        wrapModelRequest: async (handler, request) => {
          expectTypeOf(request.tools).toEqualTypeOf<
            (ServerTool | ClientTool)[]
          >();
          expectTypeOf(request.runtime.context).toEqualTypeOf<{
            customDefaultContextProp: string;
            customOptionalContextProp?: string;
            customRequiredContextProp: string;
          }>();

          return handler({
            ...request,
            tools: [tool(() => "result", { name: "toolA" })],
          });
        },
      });

      const agent = createAgent({
        middleware: [middleware] as const,
        tools: [],
        model: "gpt-4",
      });

      await agent.invoke(
        {
          messages: [new HumanMessage("Hello, world!")],
        },
        {
          configurable: {
            thread_id: "test-123",
          },
        }
      );
    });

    it("doesn't require users to pass in a context if a middleware has context schema as optional", async () => {
      const middleware = createMiddleware({
        name: "Middleware",
        contextSchema: z
          .object({
            customOptionalContextProp: z.string().default("default value"),
          })
          .optional(),
        beforeModel: async (_state, runtime) => {
          expectTypeOf(runtime.context).toEqualTypeOf<
            Partial<
              | {
                  customOptionalContextProp: string;
                }
              | undefined
            >
          >();
        },
        afterModel: async (_state, runtime) => {
          expectTypeOf(runtime.context).toEqualTypeOf<
            Partial<
              | {
                  customOptionalContextProp: string;
                }
              | undefined
            >
          >();
        },
        wrapModelRequest: async (_, request) => {
          expectTypeOf(request.runtime.context).toEqualTypeOf<
            Partial<
              | {
                  customOptionalContextProp: string;
                }
              | undefined
            >
          >();

          return new AIMessage("foobar");
        },
      });

      const agent = createAgent({
        middleware: [middleware] as const,
        tools: [],
        model: "gpt-4",
      });

      await agent.invoke(
        {
          messages: [new HumanMessage("Hello, world!")],
        },
        {
          configurable: {
            thread_id: "test-123",
          },
        }
      );
    });

    it("doesn't require users to pass in a context if all middleware context properties are optional", async () => {
      const middleware = createMiddleware({
        name: "Middleware",
        contextSchema: z.object({
          customDefaultContextProp: z.string().optional(),
        }),
        beforeModel: async (_state, runtime) => {
          expectTypeOf(runtime.context).toEqualTypeOf<
            Partial<{
              customDefaultContextProp: string;
            }>
          >();
        },
        afterModel: async (_state, runtime) => {
          expectTypeOf(runtime.context).toEqualTypeOf<
            Partial<{
              customDefaultContextProp: string;
            }>
          >();
        },
        wrapModelRequest: async (_, request) => {
          expectTypeOf(request.runtime.context).toEqualTypeOf<
            Partial<{
              customDefaultContextProp: string;
            }>
          >();

          return new AIMessage("foobar");
        },
      });

      const agent = createAgent({
        middleware: [middleware] as const,
        tools: [],
        model: "gpt-4",
      });

      await agent.invoke(
        {
          messages: [new HumanMessage("Hello, world!")],
        },
        {
          configurable: {
            thread_id: "test-123",
          },
        }
      );
    });
  });
});
