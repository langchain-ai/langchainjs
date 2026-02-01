import { describe, it, expectTypeOf } from "vitest";
import { z } from "zod/v3";
import { HumanMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import type { InferInteropZodInput } from "@langchain/core/utils/types";
import type { ServerTool, ClientTool } from "@langchain/core/tools";

import { createAgent, createMiddleware } from "../index.js";
import type { AgentBuiltInState } from "../runtime.js";
import type { InferAgentState } from "../types.js";
import type { InferMiddlewareType } from "../middleware/types.js";

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
      middleware: [middleware, middleware2],
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
    expectTypeOf(result.messages).toExtend<BaseMessage[]>();
    expectTypeOf(result.structuredResponse).toEqualTypeOf<{
      customResponseFormat: string;
    }>();
  });

  it("can properly infer custom state from agent type", () => {
    const middleware = createMiddleware({
      name: "Middleware",
      stateSchema: z.object({
        customStateProp: z.string().default("default value"),
        customRequiredStateProp: z.string(),
        customRequiredStateProp2: z.number(),
      }),
    });

    const middleware2 = createMiddleware({
      name: "Middleware2",
      stateSchema: z.object({
        customStateProp2: z.string().default("default value 2"),
      }),
    });

    const agent = createAgent({
      middleware: [middleware, middleware2],
      tools: [],
      stateSchema: z.object({
        customAgentStateProp: z.string(),
      }),
      model: "gpt-4",
      responseFormat: z.object({
        customResponseFormat: z.string(),
      }),
    });

    type AgentState = InferAgentState<typeof agent>;
    expectTypeOf<AgentState>().toMatchObjectType<{
      customAgentStateProp: string;
      customStateProp: string;
      customStateProp2: string;
      customRequiredStateProp: string;
      customRequiredStateProp2: number;
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
        middleware: [middleware],
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
        middleware: [middleware],
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
        contextSchema: z.object({
          customOptionalContextProp: z.string().optional(),
        }),
      });

      const agent = createAgent({
        middleware: [middleware],
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

    it("doesn't require users to pass in a context if a middleware has context schema with defaults or optional", async () => {
      const middleware = createMiddleware({
        name: "Middleware",
        contextSchema: z.object({
          customDefaultContextProp: z.string().default("default value"),
          customOptionalContextProp: z.string().optional(),
        }),
        stateSchema: z.object({
          customDefaultStateProp: z.string().default("default value"),
          customOptionalStateProp: z.string().optional(),
          customRequiredStateProp: z.string(),
        }),
        beforeModel: async (state, runtime) => {
          expectTypeOf(state).toEqualTypeOf<
            {
              customDefaultStateProp: string;
              customOptionalStateProp?: string;
              customRequiredStateProp: string;
            } & AgentBuiltInState
          >();
          expectTypeOf(runtime.context).toEqualTypeOf<{
            customDefaultContextProp: string;
            customOptionalContextProp?: string;
          }>();
        },
        afterModel: async (state, runtime) => {
          expectTypeOf(state).toEqualTypeOf<
            {
              customDefaultStateProp: string;
              customOptionalStateProp?: string;
              customRequiredStateProp: string;
            } & AgentBuiltInState
          >();
          expectTypeOf(runtime.context).toEqualTypeOf<{
            customDefaultContextProp: string;
            customOptionalContextProp?: string;
          }>();
        },
        wrapModelCall: async (request, handler) => {
          expectTypeOf(request.tools).toEqualTypeOf<
            (ServerTool | ClientTool)[]
          >();
          expectTypeOf(request.runtime.context).toEqualTypeOf<{
            customDefaultContextProp: string;
            customOptionalContextProp?: string;
          }>();
          expectTypeOf(request.state).toEqualTypeOf<
            {
              customDefaultStateProp: string;
              customOptionalStateProp?: string;
              customRequiredStateProp: string;
            } & AgentBuiltInState
          >();

          return handler({
            ...request,
            tools: [tool(() => "result", { name: "toolA" })],
          });
        },
        wrapToolCall: async (request, handler) => {
          expectTypeOf(request.runtime.context).toEqualTypeOf<{
            customDefaultContextProp: string;
            customOptionalContextProp?: string;
          }>();
          expectTypeOf(request.state).toEqualTypeOf<
            {
              customDefaultStateProp: string;
              customOptionalStateProp?: string;
              customRequiredStateProp: string;
            } & AgentBuiltInState
          >();

          return handler(request);
        },
      });

      const agent = createAgent({
        middleware: [middleware],
        tools: [],
        model: "gpt-4",
      });

      await agent.invoke(
        {
          messages: [new HumanMessage("Hello, world!")],
          customRequiredStateProp: "default value",
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
        contextSchema: z.object({
          customOptionalContextProp: z.string().default("default value"),
        }),
        beforeModel: async (_state, runtime) => {
          expectTypeOf(runtime.context).toEqualTypeOf<{
            customOptionalContextProp: string;
          }>();
        },
        afterModel: async (_state, runtime) => {
          expectTypeOf(runtime.context).toEqualTypeOf<{
            customOptionalContextProp: string;
          }>();
        },
        wrapModelCall: async (request) => {
          expectTypeOf(request.runtime.context).toEqualTypeOf<{
            customOptionalContextProp: string;
          }>();

          return new AIMessage("foobar");
        },
      });

      const agent = createAgent({
        middleware: [middleware],
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
        wrapModelCall: async (request) => {
          expectTypeOf(request.runtime.context).toEqualTypeOf<
            Partial<{
              customDefaultContextProp: string;
            }>
          >();

          return new AIMessage("foobar");
        },
      });

      const agent = createAgent({
        middleware: [middleware],
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

  it("should infer middleware type", () => {
    const middleware = createMiddleware({
      name: "Middleware",
      contextSchema: z.object({
        customContextProp: z.string().default("default value"),
      }),
      stateSchema: z.object({
        customStateProp: z.string().default("default value"),
      }),
      tools: [
        tool(
          () => ({
            foo: "bar",
          }),
          { name: "toolA", schema: z.object({ bar: z.number() }) }
        ),
      ],
    });
    type ContextSchema = InferMiddlewareType<
      typeof middleware,
      "ContextSchema"
    >;
    type ContextSchemaInput = InferInteropZodInput<ContextSchema>;
    expectTypeOf<ContextSchemaInput>().toEqualTypeOf<{
      customContextProp?: string | undefined;
    }>();
    type FullContext = InferMiddlewareType<typeof middleware, "FullContext">;
    expectTypeOf<FullContext>().toEqualTypeOf<{
      customContextProp: string;
    }>();
    type StateSchema = InferMiddlewareType<typeof middleware, "Schema">;
    type StateSchemaInput = InferInteropZodInput<StateSchema>;
    expectTypeOf<StateSchemaInput>().toEqualTypeOf<{
      customStateProp?: string | undefined;
    }>();
    type Tools = InferMiddlewareType<typeof middleware, "Tools">;
    expectTypeOf<Tools[0]>().toExtend<ClientTool>();
  });
});
