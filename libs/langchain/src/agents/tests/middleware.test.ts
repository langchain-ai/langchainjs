/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, expectTypeOf } from "vitest";
import { z } from "zod/v3";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  BaseMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";

import { createAgent, createMiddleware } from "../index.js";
import { FakeToolCallingChatModel, FakeToolCallingModel } from "./utils.js";

describe("middleware", () => {
  it("should propagate state schema to middleware hooks and result", async () => {
    /**
     * skip as test requires primitives from `@langchain/core` that aren't released yet
     * and fails in dependency range tests, remove after next release
     */
    if (process.env.LC_DEPENDENCY_RANGE_TESTS) {
      return;
    }
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
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("The weather in Tokyo is 25°C")],
    });
    const middlewareA = createMiddleware({
      name: "middlewareA",
      stateSchema: z.object({
        middlewareABeforeModelState: z.string(),
        middlewareAAfterModelState: z.string(),
      }),
      beforeModel: (state) => {
        const { messages, ...rest } = state;
        expect(rest).toEqual({
          middlewareABeforeModelState: "ABefore",
          middlewareAAfterModelState: "AAfter",
        });
        return {
          middlewareABeforeModelState: "middlewareABeforeModelState",
        };
      },
      afterModel: (state) => {
        const { messages, ...rest } = state;
        expect(rest).toEqual({
          middlewareABeforeModelState: "middlewareABeforeModelState",
          middlewareAAfterModelState: "AAfter",
        });
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
        const { messages, ...rest } = state;
        expect(rest).toEqual({
          middlewareBAfterModelState: "BAfter",
          middlewareBBeforeModelState: "BBefore",
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
          middlewareCAfterModelState: "CAfter",
          middlewareCBeforeModelState: "CBefore",
        });
        return {
          middlewareCAfterModelState: "middlewareCAfterModelState",
        };
      },
    });
    const agent = createAgent({
      model,
      tools: [],
      middleware: [middlewareA, middlewareB, middlewareC] as const,
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
    const model = new FakeToolCallingChatModel({
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
      model,
      tools: [],
      contextSchema: z.object({
        customContext: z.string(),
        customContext2: z.number().default(42),
      }),
      middleware: [middleware] as const,
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

  describe("control actions", () => {
    it("should terminate the agent in beforeModel hook", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("The weather in Tokyo is 25°C")],
      });
      const middleware = createMiddleware({
        name: "middleware",
        beforeModel: () => {
          throw new Error("middleware terminated");
        },
      });
      const toolFn = vi.fn();
      const agent = createAgent({
        model,
        tools: [
          tool(toolFn, {
            name: "tool",
            description: "tool",
            schema: z.object({
              name: z.string(),
            }),
          }),
        ],
        middleware: [middleware] as const,
      });
      await expect(
        agent.invoke({
          messages: [new HumanMessage("Hello, world!")],
        })
      ).rejects.toThrow("middleware terminated");
      expect(toolFn).not.toHaveBeenCalled();
    });

    it("should terminate the agent in afterModel hook", async () => {
      const model = new FakeToolCallingModel({
        toolCalls: [[{ id: "call_1", name: "tool", args: { name: "test" } }]],
      });
      const beforeModel = vi.fn();
      const middleware = createMiddleware({
        name: "middleware",
        beforeModel,
        afterModel: () => {
          throw new Error("middleware terminated in afterModel");
        },
      });
      const toolFn = vi.fn();
      const agent = createAgent({
        model,
        tools: [
          tool(toolFn, {
            name: "tool",
            description: "tool",
            schema: z.object({
              name: z.string(),
            }),
          }),
        ],
        middleware: [middleware] as const,
      });
      await expect(
        agent.invoke({
          messages: [new HumanMessage("Hello, world!")],
        })
      ).rejects.toThrow("middleware terminated in afterModel");
      expect(toolFn).toHaveBeenCalledTimes(0);
      expect(beforeModel).toHaveBeenCalledTimes(1);
    });

    it("should throw if middleware jumps but target is not defined", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("The weather in Tokyo is 25°C")],
      });
      const middleware = createMiddleware({
        name: "foobar",
        beforeModel: () => {
          return {
            jumpTo: "model",
          };
        },
      });
      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware] as const,
      });
      await expect(
        agent.invoke({ messages: [new HumanMessage("Hello, world!")] })
      ).rejects.toThrow(
        "Invalid jump target: model, no beforeModelJumpTo defined in middleware foobar."
      );
    });

    it("should throw if middleware jumps but target is not defined", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("The weather in Tokyo is 25°C")],
      });
      const middleware = createMiddleware({
        name: "foobar",
        beforeModelJumpTo: [],
        beforeModel: () => {
          return {
            jumpTo: "model",
          };
        },
      });
      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware] as const,
      });
      await expect(
        agent.invoke({ messages: [new HumanMessage("Hello, world!")] })
      ).rejects.toThrow(
        "Invalid jump target: model, no beforeModelJumpTo defined in middleware foobar."
      );
    });

    it("should throw if middleware jumps but target is not valid", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("The weather in Tokyo is 25°C")],
      });
      const middleware = createMiddleware({
        name: "foobar",
        beforeModelJumpTo: ["tools", "end"],
        beforeModel: () => {
          return {
            jumpTo: "model",
          };
        },
      });
      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware] as const,
      });
      await expect(
        agent.invoke({ messages: [new HumanMessage("Hello, world!")] })
      ).rejects.toThrow(
        "Invalid jump target: model, must be one of: tools, end."
      );
    });
  });

  describe("wrapModelRequest", () => {
    it("should compose three middlewares where first is outermost wrapper", async () => {
      /**
       * Test demonstrates:
       * 1. Middleware composition order (first middleware wraps all others)
       * 2. Request modification (each middleware adds to system prompt)
       * 3. Response modification (each middleware adds prefix to response)
       *
       * Expected flow:
       * - Request: auth -> retry -> cache -> model
       * - Response: model -> cache -> retry -> auth
       */

      const executionOrder: string[] = [];
      const systemPrompts: string[] = [];
      let actualSystemPromptSentToModel: string | undefined;

      // Auth middleware (first = outermost wrapper)
      const authMiddleware = createMiddleware({
        name: "AuthMiddleware",
        contextSchema: z.object({
          foobar: z.string().optional(),
        }),
        wrapModelRequest: async (handler, request) => {
          executionOrder.push("auth:before");
          systemPrompts.push(request.systemPrompt || "");

          // Modify request: add auth context to system prompt
          const modifiedRequest = {
            ...request,
            systemPrompt: `${
              request.systemPrompt || ""
            }\n[AUTH: user authenticated]`,
          };

          // Call inner handler (retry middleware)
          const response = await handler(modifiedRequest);

          executionOrder.push("auth:after");

          // Modify response: add auth prefix
          return new AIMessage({
            ...response,
            content: `[AUTH-WRAPPED] ${response.content}`,
          });
        },
      });

      // Retry middleware (second = middle wrapper)
      const retryMiddleware = createMiddleware({
        name: "RetryMiddleware",
        wrapModelRequest: async (handler, request) => {
          executionOrder.push("retry:before");
          systemPrompts.push(request.systemPrompt || "");

          // Modify request: add retry info to system prompt
          const modifiedRequest = {
            ...request,
            systemPrompt: `${request.systemPrompt || ""}\n[RETRY: attempt 1]`,
          };

          // Call inner handler (cache middleware)
          const response = await handler(modifiedRequest);

          executionOrder.push("retry:after");

          // Modify response: add retry prefix
          return new AIMessage({
            ...response,
            content: `[RETRY-WRAPPED] ${response.content}`,
          });
        },
      });

      // Cache middleware (third = innermost wrapper, closest to model)
      const cacheMiddleware = createMiddleware({
        name: "CacheMiddleware",
        wrapModelRequest: async (handler, request) => {
          executionOrder.push("cache:before");
          systemPrompts.push(request.systemPrompt || "");

          // Modify request: add cache info to system prompt
          const modifiedRequest = {
            ...request,
            systemPrompt: `${request.systemPrompt || ""}\n[CACHE: miss]`,
          };

          // Capture what will actually be sent to the model
          actualSystemPromptSentToModel = modifiedRequest.systemPrompt;

          // Call inner handler (base model handler)
          const response = await handler(modifiedRequest);

          executionOrder.push("cache:after");

          // Modify response: add cache prefix
          return new AIMessage({
            ...response,
            content: `[CACHE-WRAPPED] ${response.content}`,
          });
        },
      });

      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Hello from model")],
      });

      // Spy on the model's invoke to verify what it receives
      const invokeSpy = vi.spyOn(model, "invoke");

      const agent = createAgent({
        model,
        tools: [],
        systemPrompt: "You are helpful",
        middleware: [authMiddleware, retryMiddleware, cacheMiddleware] as const,
      });

      const result = await agent.invoke({
        messages: [{ role: "user", content: "Hi" }],
      });

      // Verify execution order: auth -> retry -> cache -> model -> cache -> retry -> auth
      expect(executionOrder).toEqual([
        "auth:before",
        "retry:before",
        "cache:before",
        "cache:after",
        "retry:after",
        "auth:after",
      ]);

      // Verify system prompts were accumulated correctly
      // Each middleware sees the prompt BEFORE it adds its own modification
      expect(systemPrompts).toHaveLength(3);
      expect(systemPrompts).toMatchInlineSnapshot(`
      [
        "You are helpful",
        "You are helpful
      [AUTH: user authenticated]",
        "You are helpful
      [AUTH: user authenticated]
      [RETRY: attempt 1]",
      ]
    `);

      // Verify response was wrapped in correct order (innermost to outermost)
      const lastMessage = result.messages[result.messages.length - 1];
      expect(lastMessage.content).toBe(
        "[AUTH-WRAPPED] [RETRY-WRAPPED] [CACHE-WRAPPED] Hello from model"
      );

      // Verify the final system prompt that was sent to the model
      expect(actualSystemPromptSentToModel).toMatchInlineSnapshot(`
      "You are helpful
      [AUTH: user authenticated]
      [RETRY: attempt 1]
      [CACHE: miss]"
    `);

      // Verify model received the correct messages structure
      expect(invokeSpy).toHaveBeenCalledTimes(1);
      const [systemMessage] = invokeSpy.mock.calls[0][0] as BaseMessage[];

      // Model should receive system message + user message
      expect(systemMessage).toBeInstanceOf(SystemMessage);
      expect(systemMessage.content).toBe(actualSystemPromptSentToModel);
    });

    it("should allow middleware to access state and runtime", async () => {
      /**
       * Test verifies that middleware receives state and runtime in the request
       */
      let capturedState: any;
      let capturedRuntime: any;

      const inspectorMiddleware = createMiddleware({
        name: "InspectorMiddleware",
        stateSchema: z.object({
          foobar: z.string(),
        }),
        contextSchema: z.object({
          middlewareContext: z.number(),
        }),
        wrapModelRequest: async (handler, request) => {
          expectTypeOf(request.state).toMatchObjectType<{
            foobar: string;
            messages: BaseMessage[];
          }>();
          expectTypeOf(request.runtime.context).toMatchObjectType<{
            middlewareContext: number;
          }>();
          expectTypeOf(request.systemPrompt!).toBeString();
          expectTypeOf(request.runtime.runModelCallCount).toBeNumber();
          expectTypeOf(request.runtime.threadLevelCallCount).toBeNumber();

          // Capture state and runtime
          capturedState = request.state;
          capturedRuntime = request.runtime as unknown as Record<
            string,
            unknown
          >;

          return handler(request);
        },
      });

      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [inspectorMiddleware] as const,
        contextSchema: z.object({
          globalContext: z.number(),
        }),
      });

      await agent.invoke(
        {
          messages: [{ role: "user", content: "Test" }],
          foobar: "123",
        },
        {
          context: {
            globalContext: 1,
            middlewareContext: 2,
          },
        }
      );

      // Verify state was provided and contains messages
      expect(capturedState).toBeDefined();
      expect(capturedState?.messages).toBeDefined();
      expect(Array.isArray(capturedState?.messages)).toBe(true);
      expect((capturedState?.messages as BaseMessage[])[0].content).toBe(
        "Test"
      );

      const { context, threadLevelCallCount, runModelCallCount } =
        capturedRuntime;
      expect({
        context,
        threadLevelCallCount,
        runModelCallCount,
      }).toMatchInlineSnapshot(`
      {
        "context": {
          "middlewareContext": 2,
        },
        "runModelCallCount": 0,
        "threadLevelCallCount": 0,
      }
    `);
    });

    it("should handle errors in middleware and allow retry", async () => {
      /**
       * Test shows how middleware can handle errors and retry with modifications
       */

      let attemptCount = 0;

      const errorHandlingMiddleware = createMiddleware({
        name: "ErrorHandlingMiddleware",
        wrapModelRequest: async (handler, request) => {
          attemptCount++;

          try {
            return await handler(request);
          } catch (error) {
            // First attempt fails, retry with different model behavior
            if (attemptCount === 1) {
              // Retry with modified request
              const retryRequest = {
                ...request,
                systemPrompt: `${request.systemPrompt}\n[RETRY: Attempting recovery]`,
              };
              return await handler(retryRequest);
            }
            throw error;
          }
        },
      });

      // Model that fails first time, succeeds second time
      let callCount = 0;
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage("This should not appear"),
          new AIMessage("Success after retry"),
        ],
      });

      // Override _generate to throw on first call
      const originalGenerate = model._generate.bind(model);
      model._generate = async function (messages, options, runManager) {
        callCount++;
        if (callCount === 1) {
          // Increment idx before throwing so next call uses next response
          this.idx++;
          throw new Error("Temporary failure");
        }
        return originalGenerate(messages, options, runManager);
      };

      const agent = createAgent({
        model,
        tools: [],
        systemPrompt: "You are helpful",
        middleware: [errorHandlingMiddleware],
      });

      const result = await agent.invoke({
        messages: [{ role: "user", content: "Hi" }],
      });

      // Verify middleware retried
      expect(attemptCount).toBe(1);
      expect(callCount).toBe(2);

      // Verify we got the success response
      expect(result.messages).toHaveLength(2);
      const lastMessage = result.messages[result.messages.length - 1];
      expect(lastMessage.content).toBe("Success after retry");
    });

    it("should allow middleware to modify model and tools", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Guten Tag!")],
      });
      const pirateModel = new FakeToolCallingChatModel({
        responses: [new AIMessage("Arr matey!")],
      });
      const modifyingMiddleware = createMiddleware({
        name: "ModifyingMiddleware",
        wrapModelRequest: async (handler, request) => {
          // Middleware could modify the request in various ways
          const modifiedRequest = {
            ...request,
            systemPrompt: "OVERRIDDEN: You are a pirate",
            model: pirateModel,
          };

          return handler(modifiedRequest);
        },
      });

      const agent = createAgent({
        model,
        tools: [],
        systemPrompt: "You are helpful",
        middleware: [modifyingMiddleware],
      });

      const result = await agent.invoke({
        messages: [{ role: "user", content: "Hi" }],
      });

      // Verify the agent completed successfully with modified behavior
      expect(result.messages.at(-1)?.content).toBe("Arr matey!");
    });

    it("should allow to skip model call", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Arr matey!")],
      });
      const modifyingMiddleware = createMiddleware({
        name: "ModifyingMiddleware",
        wrapModelRequest: () => new AIMessage("skipped"),
      });

      const agent = createAgent({
        model,
        systemPrompt: "You are helpful",
        middleware: [modifyingMiddleware] as const,
      });

      const result = await agent.invoke({
        messages: [{ role: "user", content: "Hi" }],
      });

      // Verify the agent completed successfully with modified behavior
      expect(result.messages.at(-1)?.content).toBe("skipped");
    });

    it("should throw meaningful error if something invalid gets returned", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Arr matey!")],
      });
      const modifyingMiddleware = createMiddleware({
        name: "ModifyingMiddleware",
        // @ts-expect-error should have AIMessage as return value
        wrapModelRequest: () => {},
      });

      const agent = createAgent({
        model,
        systemPrompt: "You are helpful",
        middleware: [modifyingMiddleware] as const,
      });

      await expect(
        agent.invoke({
          messages: [{ role: "user", content: "Hi" }],
        })
      ).rejects.toThrow(
        'Invalid response from "wrapModelRequest" in middleware "ModifyingMiddleware": expected AIMessage, got undefined'
      );
    });

    it("should propagate the middleware name in the error", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Arr matey!")],
      });
      const modifyingMiddleware = createMiddleware({
        name: "ModifyingMiddleware",
        wrapModelRequest: () => {
          throw new Error("foobar");
        },
      });

      const agent = createAgent({
        model,
        systemPrompt: "You are helpful",
        middleware: [modifyingMiddleware] as const,
      });

      await expect(
        agent.invoke({
          messages: [{ role: "user", content: "Hi" }],
        })
      ).rejects.toThrow('Error in middleware "ModifyingMiddleware": foobar');
    });

    it("should allow middleware to modify tool calls in response", async () => {
      /**
       * Test demonstrates middleware intercepting and modifying tool calls
       * Model calls toolA, but middleware changes it to toolB
       */

      // Define two tools
      const toolAMock = vi.fn(
        async ({ input }: { input: string }) => `Tool A executed: ${input}`
      );
      const toolA = tool(toolAMock, {
        name: "toolA",
        description: "Tool A",
        schema: z.object({
          input: z.string(),
        }),
      });

      const toolBMock = vi.fn(
        async ({ input }: { input: string }) => `Tool B executed: ${input}`
      );
      const toolB = tool(toolBMock, {
        name: "toolB",
        description: "Tool B",
        schema: z.object({
          input: z.string(),
        }),
      });

      let originalToolCall: string | undefined;
      let modifiedToolCall: string | undefined;

      // Middleware that intercepts and modifies tool calls
      const toolRedirectMiddleware = createMiddleware({
        name: "ToolRedirectMiddleware",
        wrapModelRequest: async (handler, request) => {
          // Call the model
          const response = await handler(request);

          // If the response has tool calls, modify them
          if (response.tool_calls && response.tool_calls.length > 0) {
            originalToolCall = response.tool_calls[0].name;

            // Change tool call from toolA to toolB
            if (response.tool_calls[0].name === "toolA") {
              modifiedToolCall = "toolB";

              return new AIMessage({
                ...response,
                content: response.content,
                tool_calls: [
                  {
                    ...response.tool_calls[0],
                    name: "toolB",
                    // Keep the same arguments
                    args: response.tool_calls[0].args,
                  },
                ],
              });
            }
          }

          return response;
        },
      });

      // Model that calls toolA
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              {
                id: "call_1",
                name: "toolA",
                args: { input: "test data" },
              },
            ],
          }),
          new AIMessage("Done"),
        ],
      });

      const agent = createAgent({
        model,
        tools: [toolA, toolB],
        middleware: [toolRedirectMiddleware],
      });

      const result = await agent.invoke({
        messages: [{ role: "user", content: "Call a tool" }],
      });

      // Verify the tool call was modified
      expect(originalToolCall).toBe("toolA");
      expect(modifiedToolCall).toBe("toolB");

      // Verify toolB was actually executed (not toolA)
      const toolMessage = result.messages.find((m) =>
        ToolMessage.isInstance(m)
      ) as any;
      expect(toolMessage).toBeDefined();
      expect(toolMessage.content).toContain("Tool B executed: test data");
      expect(toolMessage.name).toBe("toolB");

      expect(toolAMock).not.toBeCalled();
      expect(toolBMock).toBeCalled();
    });

    it("should support async operations in middleware", async () => {
      /**
       * Test verifies middleware can perform async operations
       */

      const delays: number[] = [];

      const asyncMiddleware1 = createMiddleware({
        name: "AsyncMiddleware1",
        wrapModelRequest: async (handler, request) => {
          const start = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 50));
          const delay = Date.now() - start;
          delays.push(delay);

          return handler(request);
        },
      });

      const asyncMiddleware2 = createMiddleware({
        name: "AsyncMiddleware2",
        wrapModelRequest: async (handler, request) => {
          const start = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 30));
          const delay = Date.now() - start;
          delays.push(delay);

          return handler(request);
        },
      });

      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
        sleep: 0, // No sleep in model to test middleware timing
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [asyncMiddleware1, asyncMiddleware2],
      });

      const startTime = Date.now();
      await agent.invoke({
        messages: [{ role: "user", content: "Test" }],
      });
      const totalTime = Date.now() - startTime;

      // Verify async operations occurred
      expect(delays).toHaveLength(2);
      expect(delays[0]).toBeGreaterThanOrEqual(45); // ~50ms
      expect(delays[1]).toBeGreaterThanOrEqual(25); // ~30ms

      // Total time should be at least the sum of delays
      expect(totalTime).toBeGreaterThanOrEqual(75);
    });

    it("should pass correct state to each middleware", async () => {
      const middleware1 = createMiddleware({
        name: "Middleware1",
        wrapModelRequest: async (handler, request) => {
          /**
           * we don't allow to change state within these hooks
           */
          expect(request.state.messages.length).toBe(2);
          return handler({
            ...request,
            messages: [...request.messages, new AIMessage("some changes")],
          });
        },
      });

      const middleware2 = createMiddleware({
        name: "Middleware2",
        wrapModelRequest: async (handler, request) => {
          /**
           * we don't allow to change state within these hooks
           */
          expect(request.state.messages.length).toBe(2);
          return handler({
            ...request,
            messages: [...request.messages, new AIMessage("some changes")],
          });
        },
      });

      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware1, middleware2],
      });

      await agent.invoke({
        messages: [
          { role: "user", content: "Message 1" },
          { role: "assistant", content: "Message 2" },
        ],
      });
    });
  });
});
