/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, expectTypeOf } from "vitest";
import { z } from "zod/v3";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  BaseMessage,
  ToolMessage,
  ToolCall,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { Command } from "@langchain/langgraph";

import { createAgent, createMiddleware, toolStrategy } from "../index.js";
import { FakeToolCallingChatModel, FakeToolCallingModel } from "./utils.js";
import { MiddlewareError } from "../errors.js";

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
      middleware: [middlewareA, middlewareB, middlewareC],
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
      middleware: [middleware],
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
        middleware: [middleware],
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
        middleware: [middleware],
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
        middleware: [middleware],
      });
      await expect(
        agent.invoke({ messages: [new HumanMessage("Hello, world!")] })
      ).rejects.toThrow(
        "Invalid jump target: model, no beforeModel.canJumpTo defined in middleware foobar."
      );
    });

    it("should throw if middleware jumps but target is not defined", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("The weather in Tokyo is 25°C")],
      });
      const middleware = createMiddleware({
        name: "foobar",
        beforeModel: {
          canJumpTo: [],
          hook: () => {
            return {
              jumpTo: "model",
            };
          },
        },
      });
      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware],
      });
      await expect(
        agent.invoke({ messages: [new HumanMessage("Hello, world!")] })
      ).rejects.toThrow(
        "Invalid jump target: model, no beforeModel.canJumpTo defined in middleware foobar."
      );
    });

    it("should throw if middleware jumps but target is not valid", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("The weather in Tokyo is 25°C")],
      });
      const middleware = createMiddleware({
        name: "foobar",
        beforeModel: {
          hook: () => {
            return {
              jumpTo: "model",
            };
          },
          canJumpTo: ["tools", "end"],
        },
      });
      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware],
      });
      await expect(
        agent.invoke({ messages: [new HumanMessage("Hello, world!")] })
      ).rejects.toThrow(
        "Invalid jump target: model, must be one of: tools, end."
      );
    });
  });

  describe("wrapModelCall", () => {
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
        wrapModelCall: async (request, handler) => {
          executionOrder.push("auth:before");
          systemPrompts.push(request.systemMessage.text);

          // Modify request: add auth context to system prompt
          const modifiedRequest = {
            ...request,
            systemMessage: request.systemMessage.concat(
              "\n[AUTH: user authenticated]"
            ),
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
        wrapModelCall: async (request, handler) => {
          executionOrder.push("retry:before");
          systemPrompts.push(request.systemMessage.text);

          // Modify request: add retry info to system prompt
          const modifiedRequest = {
            ...request,
            systemMessage: request.systemMessage.concat("\n[RETRY: attempt 1]"),
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
        wrapModelCall: async (request, handler) => {
          executionOrder.push("cache:before");
          systemPrompts.push(request.systemMessage.text);

          // Modify request: add cache info to system prompt
          const modifiedRequest = {
            ...request,
            systemMessage: request.systemMessage.concat("\n[CACHE: miss]"),
          };

          // Capture what will actually be sent to the model
          actualSystemPromptSentToModel = modifiedRequest.systemMessage.text;

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
        middleware: [authMiddleware, retryMiddleware, cacheMiddleware],
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
      expect(systemMessage.content).toEqual([
        {
          text: "You are helpful",
          type: "text",
        },
        {
          text: "\n[AUTH: user authenticated]",
          type: "text",
        },
        {
          text: "\n[RETRY: attempt 1]",
          type: "text",
        },
        {
          text: "\n[CACHE: miss]",
          type: "text",
        },
      ]);
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
        wrapModelCall: async (request, handler) => {
          expectTypeOf(request.state).toMatchObjectType<{
            foobar: string;
            messages: BaseMessage[];
          }>();
          expectTypeOf(request.runtime.context).toMatchObjectType<{
            middlewareContext: number;
          }>();
          expectTypeOf(request.systemPrompt!).toBeString();

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
        middleware: [inspectorMiddleware],
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

      const { context } = capturedRuntime;
      expect({
        context,
      }).toMatchInlineSnapshot(`
      {
        "context": {
          "middlewareContext": 2,
        },
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
        wrapModelCall: async (request, handler) => {
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
        wrapModelCall: async (request, handler) => {
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
        wrapModelCall: () => new AIMessage("skipped"),
      });

      const agent = createAgent({
        model,
        systemPrompt: "You are helpful",
        middleware: [modifyingMiddleware],
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
        wrapModelCall: () => {},
      });

      const agent = createAgent({
        model,
        systemPrompt: "You are helpful",
        middleware: [modifyingMiddleware],
      });

      await expect(
        agent.invoke({
          messages: [{ role: "user", content: "Hi" }],
        })
      ).rejects.toThrow("expected AIMessage, got undefined");
    });

    it("should propagate the middleware name in the error", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Arr matey!")],
      });
      const modifyingMiddleware = createMiddleware({
        name: "ModifyingMiddleware",
        wrapModelCall: () => {
          throw new Error("foobar");
        },
      });

      const agent = createAgent({
        model,
        systemPrompt: "You are helpful",
        middleware: [modifyingMiddleware],
      });

      await expect(
        agent.invoke({
          messages: [{ role: "user", content: "Hi" }],
        })
      ).rejects.toThrow("foobar");
    });

    it("should not nest middleware error prefixes when middleware re-throws errors", async () => {
      const innerMiddleware = createMiddleware({
        name: "InnerMiddleware",
        wrapModelCall: () => {
          throw new Error("original error");
        },
      });

      const innerModel = new FakeToolCallingChatModel({
        responses: [new AIMessage("Inner response")],
      });

      const innerAgent = createAgent({
        model: innerModel,
        systemPrompt: "You are an inner agent",
        middleware: [innerMiddleware],
      });

      const subAgentTool = tool(
        async () => {
          await innerAgent.invoke({
            messages: [{ role: "user", content: "Hi" }],
          });
          return "success";
        },
        {
          name: "subAgentTool",
          description: "A tool that spawns a sub-agent",
          schema: z.object({}),
        }
      );

      // Outer model that calls the subAgentTool
      const outerModel = new FakeToolCallingModel({
        toolCalls: [[{ name: "subAgentTool", args: {}, id: "1" }]],
      });

      // Outer middleware that wraps tool calls and invokes the inner agent
      const outerMiddleware = createMiddleware({
        name: "OuterMiddleware",
        wrapToolCall: async (request, handler) => {
          return handler(request);
        },
      });

      const agent = createAgent({
        model: outerModel,
        tools: [subAgentTool],
        systemPrompt: "You are an outer agent",
        middleware: [outerMiddleware],
      });

      // Should only show the innermost middleware prefix, not nested prefixes
      const error = await agent
        .invoke({
          messages: [{ role: "user", content: "Hi" }],
        })
        .catch((err) => err);

      expect(error).toBeInstanceOf(MiddlewareError);
      expect(error.name).toBe("Error");
      expect(error.message).toBe("original error");
      expect(error.cause).toBeInstanceOf(MiddlewareError);
      expect(error.cause?.cause).toBeInstanceOf(Error);
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
        wrapModelCall: async (request, handler) => {
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
        wrapModelCall: async (request, handler) => {
          const start = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 50));
          const delay = Date.now() - start;
          delays.push(delay);

          return handler(request);
        },
      });

      const asyncMiddleware2 = createMiddleware({
        name: "AsyncMiddleware2",
        wrapModelCall: async (request, handler) => {
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
        wrapModelCall: async (request, handler) => {
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
        wrapModelCall: async (request, handler) => {
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

  describe("wrapToolCall", () => {
    it("should allow middleware to wrap tool execution and modify args and response", async () => {
      /**
       * Test demonstrates middleware intercepting tool calls for logging
       */
      const toolExecutions: string[] = [];

      const weatherToolMock = vi.fn(
        async ({ location }: { location: string }) =>
          `Weather in ${location}: Sunny`
      );
      const weatherTool = tool(weatherToolMock, {
        name: "get_weather",
        description: "Get weather for a location",
        schema: z.object({
          location: z.string(),
        }),
      });

      // Middleware that logs tool executions and modifies the result
      const loggingMiddleware = createMiddleware({
        name: "LoggingMiddleware",
        contextSchema: z.object({
          foo: z.number(),
        }),
        stateSchema: z.object({
          bar: z.boolean(),
        }),
        wrapToolCall: async (request, handler) => {
          toolExecutions.push(`before:${request.toolCall.name}`);
          expect(request.tool?.name).toBe("get_weather");
          expect(request.tool?.description).toBe("Get weather for a location");
          expect(request.toolCall).toMatchInlineSnapshot(`
            {
              "args": {
                "location": "SF",
              },
              "id": "1",
              "name": "get_weather",
              "type": "tool_call",
            }
          `);
          expect(request.runtime.context).toEqual({ foo: 123 });
          expect(request.state.bar).toBe(true);

          /**
           * Let's test if we can modify tool args
           */
          (request.toolCall.args as any).location += "O";

          const result = (await handler(request)) as ToolMessage;
          toolExecutions.push(`after:${request.toolCall.name}`);

          /**
           * Create a new ToolMessage with modified content
           */
          return new ToolMessage({
            content: `${result.content} (modified)`,
            tool_call_id: result.tool_call_id,
            name: result.name,
          });
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "get_weather", args: { location: "SF" }, id: "1" }],
        ],
      });

      const agent = createAgent({
        model,
        tools: [weatherTool],
        middleware: [loggingMiddleware],
      });

      const result = await agent.invoke(
        {
          messages: [new HumanMessage("What's the weather in SF?")],
          bar: true,
        },
        {
          context: {
            foo: 123,
          },
        }
      );

      expect(weatherToolMock).toHaveBeenCalledOnce();
      expect(toolExecutions).toEqual([
        "before:get_weather",
        "after:get_weather",
      ]);
      expect(result.messages).toHaveLength(3);
      // Verify the middleware modified the content
      expect((result.messages[2] as ToolMessage).content).toBe(
        "Weather in SFO: Sunny (modified)"
      );
    });

    it("should chain multiple wrapToolCall handlers correctly", async () => {
      /**
       * Test demonstrates multiple middleware chaining tool calls
       * Order should be: outer -> inner -> tool -> inner -> outer
       */
      const executionOrder: string[] = [];

      const calculatorTool = tool(
        async ({ expression }: { expression: string }) => {
          executionOrder.push("tool_execute");
          return `Result: ${expression}`;
        },
        {
          name: "calculator",
          description: "Calculate an expression",
          schema: z.object({
            expression: z.string(),
          }),
        }
      );

      // First middleware (outer layer)
      const authMiddleware = createMiddleware({
        name: "AuthMiddleware",
        wrapToolCall: async (request, handler) => {
          executionOrder.push("auth_before");
          const result = await handler(request);
          executionOrder.push("auth_after");
          return result;
        },
      });

      // Second middleware (inner layer)
      const cacheMiddleware = createMiddleware({
        name: "CacheMiddleware",
        wrapToolCall: async (request, handler) => {
          executionOrder.push("cache_before");
          const result = await handler(request);
          executionOrder.push("cache_after");
          return result;
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "calculator", args: { expression: "2+2" }, id: "1" }],
        ],
      });

      const agent = createAgent({
        model,
        tools: [calculatorTool],
        middleware: [authMiddleware, cacheMiddleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Calculate 2+2")],
      });

      // Verify the execution order: auth wraps cache wraps tool
      expect(executionOrder).toEqual([
        "auth_before",
        "cache_before",
        "tool_execute",
        "cache_after",
        "auth_after",
      ]);
    });

    it("should allow middleware to handle tool errors", async () => {
      /**
       * Test demonstrates middleware catching and handling tool errors
       */
      const failingTool = tool(
        async () => {
          throw new Error("Tool execution failed");
        },
        {
          name: "failing_tool",
          description: "A tool that always fails",
          schema: z.object({}),
        }
      );

      // Middleware that catches errors and returns custom message
      const errorHandlerMiddleware = createMiddleware({
        name: "ErrorHandlerMiddleware",
        wrapToolCall: async (request, handler) => {
          try {
            return await handler(request);
          } catch (error) {
            return new ToolMessage({
              content: `Error handled by middleware: ${error}`,
              tool_call_id: request.toolCall.id!,
            });
          }
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "failing_tool", args: {}, id: "1" }]],
      });

      const agent = createAgent({
        model,
        tools: [failingTool],
        middleware: [errorHandlerMiddleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Call the failing tool")],
      });

      const toolMessage = result.messages[2] as ToolMessage;
      expect(toolMessage.content).toContain("Error handled by middleware");
    });

    it("should provide access to state in wrapToolCall", async () => {
      /**
       * Test demonstrates middleware accessing state in wrapToolCall
       */
      let capturedState: any = null;

      const echoTool = tool(
        async ({ message }: { message: string }) => `Echo: ${message}`,
        {
          name: "echo",
          description: "Echo a message",
          schema: z.object({
            message: z.string(),
          }),
        }
      );

      // Middleware that captures state
      const stateCaptureMiddleware = createMiddleware({
        name: "StateCaptureMiddleware",
        stateSchema: z.object({
          customField: z.string(),
        }),
        wrapToolCall: async (request, handler) => {
          capturedState = request.state;
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "echo", args: { message: "hello" }, id: "1" }]],
      });

      const agent = createAgent({
        model,
        tools: [echoTool],
        middleware: [stateCaptureMiddleware],
      });

      const input = {
        messages: [new HumanMessage("Echo hello")],
        customField: "test_value",
      };
      await agent.invoke(input as any);

      // Verify state was captured
      expect(capturedState).toBeDefined();
      expect(capturedState.customField).toBe("test_value");
      expect(capturedState.messages).toBeDefined();
    });

    it("should validate that wrapToolCall returns ToolMessage or Command", async () => {
      /**
       * Test that wrapToolCall must return ToolMessage or Command
       * With default error handling (matches Python), validation errors bubble up
       */
      const validTool = tool(async () => "Success", {
        name: "valid_tool",
        description: "A valid tool",
        schema: z.object({}),
      });

      // Middleware that returns invalid type
      const invalidMiddleware = createMiddleware({
        name: "InvalidReturnMiddleware",
        wrapToolCall: async () => {
          // Return invalid type (string instead of ToolMessage or Command)
          return "invalid return value" as any;
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "valid_tool", args: {}, id: "1" }]],
      });

      const agent = createAgent({
        model,
        tools: [validTool],
        middleware: [invalidMiddleware],
      });

      // With default error handling (matches Python), validation errors bubble up
      await expect(
        agent.invoke({
          messages: [new HumanMessage("Call the valid tool")],
        })
      ).rejects.toThrow(
        'Invalid response from "wrapToolCall" in middleware "InvalidReturnMiddleware": ' +
          "expected ToolMessage or Command, got string"
      );
    });

    it("should support returning Command from wrapToolCall", async () => {
      /**
       * Test that wrapToolCall can return Command for advanced control flow
       */
      const commandTool = tool(async () => "Tool result", {
        name: "command_tool",
        description: "A tool that can return commands",
        schema: z.object({}),
      });

      const commandMiddleware = createMiddleware({
        name: "CommandMiddleware",
        wrapToolCall: async (request, handler) => {
          // Execute tool normally
          await handler(request);

          // Return a Command instead of ToolMessage
          return new Command({
            update: {
              messages: [
                new ToolMessage({
                  content: "Command-based response",
                  tool_call_id: request.toolCall.id!,
                }),
              ],
            },
          });
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "command_tool", args: {}, id: "1" }]],
      });

      const agent = createAgent({
        model,
        tools: [commandTool],
        middleware: [commandMiddleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Call command tool")],
      });

      const toolMessage = result.messages[2] as ToolMessage;
      expect(toolMessage.content).toBe("Command-based response");
    });

    it("should work with multiple tools being called", async () => {
      /**
       * Test wrapToolCall with multiple tool calls in sequence
       */
      const toolCalls: string[] = [];

      const tool1 = tool(async () => "Result 1", {
        name: "tool1",
        description: "First tool",
        schema: z.object({}),
      });

      const tool2 = tool(async () => "Result 2", {
        name: "tool2",
        description: "Second tool",
        schema: z.object({}),
      });

      const trackingMiddleware = createMiddleware({
        name: "TrackingMiddleware",
        wrapToolCall: async (request, handler) => {
          toolCalls.push(request.tool?.name as string);
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            { name: "tool1", args: {}, id: "1" },
            { name: "tool2", args: {}, id: "2" },
          ],
        ],
      });

      const agent = createAgent({
        model,
        tools: [tool1, tool2],
        middleware: [trackingMiddleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Call both tools")],
      });

      // Verify both tools were tracked
      expect(toolCalls).toEqual(["tool1", "tool2"]);
    });

    it("should work alongside wrapModelCall middleware", async () => {
      /**
       * Test that wrapToolCall and wrapModelCall can coexist
       * and that modifications to tool_calls in wrapModelCall are propagated to wrapToolCall
       */
      const events: string[] = [];
      let capturedToolCallInWrapTool: ToolCall | undefined;

      const calculatorTool = tool(async ({ x }: { x: number }) => x * 2, {
        name: "multiply",
        description: "Multiply by 2",
        schema: z.object({
          x: z.number(),
        }),
      });

      const combinedMiddleware = createMiddleware({
        name: "CombinedMiddleware",
        wrapModelCall: async (request, handler) => {
          events.push("before_model");
          const result = await handler(request);
          events.push("after_model");

          // Modify the AIMessage tool_calls
          if (result.tool_calls && result.tool_calls.length > 0) {
            return new AIMessage({
              ...result,
              content: result.content,
              tool_calls: result.tool_calls.map((tc) => ({
                ...tc,
                args: {
                  ...tc.args,
                  x: (tc.args.x as number) * 10, // Modify the argument
                },
              })),
            });
          }

          return result;
        },
        wrapToolCall: async (request, handler) => {
          events.push("before_tool");
          // Capture the tool call to verify it was modified
          capturedToolCallInWrapTool = request.toolCall;
          const result = await handler(request);
          events.push("after_tool");
          return result;
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "multiply", args: { x: 5 }, id: "1" }]],
      });

      const agent = createAgent({
        model,
        tools: [calculatorTool],
        middleware: [combinedMiddleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Multiply 5 by 2")],
      });

      // Verify both hooks were called in the right order
      // Should see: 1st model call -> tool execution -> 2nd model call (to finish)
      expect(events).toEqual([
        "before_model", // First model call
        "after_model", // First model call
        "before_tool", // Tool execution
        "after_tool", // Tool execution
        "before_model", // Second model call (to check if done)
        "after_model", // Second model call
      ]);

      // Verify that the modified tool call was propagated to wrapToolCall
      expect(capturedToolCallInWrapTool).toBeDefined();
      expect(capturedToolCallInWrapTool?.name).toBe("multiply");
      expect(capturedToolCallInWrapTool?.args.x).toBe(50); // 5 * 10 from wrapModelCall
    });

    it("should allow conditional tool execution based on state", async () => {
      /**
       * Test conditional tool execution based on agent state
       */
      const adminTool = tool(async () => "Admin action executed", {
        name: "admin_action",
        description: "An admin-only action",
        schema: z.object({}),
      });

      const authMiddleware = createMiddleware({
        name: "AuthMiddleware",
        stateSchema: z.object({
          isAdmin: z.boolean().default(false),
        }),
        wrapToolCall: async (request, handler) => {
          // Check if user is admin
          if (request.tool?.name === "admin_action" && !request.state.isAdmin) {
            return new ToolMessage({
              content: "Access denied: admin privileges required",
              tool_call_id: request.toolCall.id!,
            });
          }
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "admin_action", args: {}, id: "1" }]],
      });

      const agent = createAgent({
        model,
        tools: [adminTool],
        middleware: [authMiddleware],
      });

      // Test with non-admin user
      const result1 = await agent.invoke({
        messages: [new HumanMessage("Perform admin action")],
        isAdmin: false,
      } as any);

      const toolMessage1 = result1.messages[2] as ToolMessage;
      expect(toolMessage1.content).toBe(
        "Access denied: admin privileges required"
      );

      // Test with admin user
      const result2 = await agent.invoke({
        messages: [new HumanMessage("Perform admin action")],
        isAdmin: true,
      } as any);

      const toolMessage2 = result2.messages[2] as ToolMessage;
      expect(toolMessage2.content).toBe("Admin action executed");
    });

    it("should support tool execution timing and metrics", async () => {
      /**
       * Test collecting metrics about tool execution
       */
      const metrics: Array<{ tool: string; duration: number }> = [];

      const slowTool = tool(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 15));
          return "Slow result";
        },
        {
          name: "slow_operation",
          description: "A slow operation",
          schema: z.object({}),
        }
      );

      const metricsMiddleware = createMiddleware({
        name: "MetricsMiddleware",
        wrapToolCall: async (request, handler) => {
          const startTime = Date.now();
          const result = await handler(request);
          const duration = Date.now() - startTime;

          metrics.push({
            tool: request.tool?.name as string,
            duration,
          });

          return result;
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "slow_operation", args: {}, id: "1" }]],
      });

      const agent = createAgent({
        model,
        tools: [slowTool],
        middleware: [metricsMiddleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Run slow operation")],
      });

      expect(metrics).toHaveLength(1);
      expect(metrics[0].tool).toBe("slow_operation");
      expect(metrics[0].duration).toBeGreaterThanOrEqual(10);
    });

    it("should support retry logic with exponential backoff", async () => {
      /**
       * Test retry logic in wrapToolCall
       */
      let attemptCount = 0;
      const maxRetries = 3;

      const flakyTool = tool(
        async () => {
          attemptCount += 1;
          if (attemptCount < 3) {
            throw new Error(`Attempt ${attemptCount} failed`);
          }
          return "Success on attempt 3";
        },
        {
          name: "flaky_tool",
          description: "A flaky tool that fails twice",
          schema: z.object({}),
        }
      );

      const retryMiddleware = createMiddleware({
        name: "RetryMiddleware",
        wrapToolCall: async (request, handler) => {
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              return await handler(request);
            } catch (error) {
              if (attempt === maxRetries - 1) {
                throw error;
              }
              // Simple backoff for testing
              await new Promise((resolve) => setTimeout(resolve, 1));
            }
          }
          throw new Error("Unreachable");
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "flaky_tool", args: {}, id: "1" }]],
      });

      const agent = createAgent({
        model,
        tools: [flakyTool],
        middleware: [retryMiddleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Call flaky tool")],
      });

      // Tool should succeed after retries
      expect(attemptCount).toBe(3);
      const toolMessage = result.messages[2] as ToolMessage;
      expect(toolMessage.content).toBe("Success on attempt 3");
    });

    it("should support caching tool results", async () => {
      /**
       * Test caching tool results to avoid redundant executions
       */
      const cache = new Map<string, ToolMessage>();
      let executionCount = 0;

      const expensiveTool = tool(
        async ({ input }: { input: string }) => {
          executionCount += 1;
          return `Expensive result for: ${input}`;
        },
        {
          name: "expensive_operation",
          description: "An expensive operation",
          schema: z.object({
            input: z.string(),
          }),
        }
      );

      const cacheMiddleware = createMiddleware({
        name: "CacheMiddleware",
        wrapToolCall: async (request, handler) => {
          const cacheKey = `${request.tool?.name}:${JSON.stringify(
            request.toolCall.args
          )}`;

          // Check cache first
          if (cache.has(cacheKey)) {
            return cache.get(cacheKey)!;
          }

          // Execute and cache
          const result = (await handler(request)) as ToolMessage;
          cache.set(cacheKey, result);
          return result;
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "expensive_operation", args: { input: "test" }, id: "1" }],
          [{ name: "expensive_operation", args: { input: "test" }, id: "2" }],
          [], // No more tool calls - agent should stop
        ],
      });

      const agent = createAgent({
        model,
        tools: [expensiveTool],
        middleware: [cacheMiddleware],
      });

      // First invocation - should execute tool
      await agent.invoke(
        {
          messages: [new HumanMessage("Run expensive operation")],
        },
        {
          recursionLimit: 100,
        }
      );
      expect(executionCount).toBe(1);

      // Second invocation with same args - should use cache
      await agent.invoke(
        {
          messages: [new HumanMessage("Run expensive operation again")],
        },
        {
          recursionLimit: 100,
        }
      );
      expect(executionCount).toBe(1); // Still 1, not incremented
    });

    it("should allow modifying tool results based on tool properties", async () => {
      /**
       * Test modifying results differently based on tool metadata
       */
      const publicTool = tool(async () => "Public data", {
        name: "get_public_data",
        description: "Get public data",
        schema: z.object({}),
      });

      const privateTool = tool(async () => "Sensitive data", {
        name: "get_private_data",
        description: "Get private data",
        schema: z.object({}),
      });

      const redactionMiddleware = createMiddleware({
        name: "RedactionMiddleware",
        wrapToolCall: async (request, handler) => {
          const result = (await handler(request)) as ToolMessage;

          // Redact private tool results
          if ((request.tool?.name as string).includes("private")) {
            return new ToolMessage({
              content: "[REDACTED]",
              tool_call_id: result.tool_call_id,
              name: result.name,
            });
          }

          return result;
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            { name: "get_public_data", args: {}, id: "1" },
            { name: "get_private_data", args: {}, id: "2" },
          ],
        ],
      });

      const agent = createAgent({
        model,
        tools: [publicTool, privateTool],
        middleware: [redactionMiddleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Get both data types")],
      });

      const publicMessage = result.messages[2] as ToolMessage;
      const privateMessage = result.messages[3] as ToolMessage;

      expect(publicMessage.content).toBe("Public data");
      expect(privateMessage.content).toBe("[REDACTED]");
    });

    it("should work with three layers of middleware chaining", async () => {
      /**
       * Test complex middleware composition with three layers
       */
      const executionFlow: string[] = [];

      const testTool = tool(
        async () => {
          executionFlow.push("tool");
          return "result";
        },
        {
          name: "test",
          description: "Test",
          schema: z.object({}),
        }
      );

      const layer1 = createMiddleware({
        name: "Layer1",
        wrapToolCall: async (request, handler) => {
          executionFlow.push("layer1_before");
          const result = await handler(request);
          executionFlow.push("layer1_after");
          return result;
        },
      });

      const layer2 = createMiddleware({
        name: "Layer2",
        wrapToolCall: async (request, handler) => {
          executionFlow.push("layer2_before");
          const result = await handler(request);
          executionFlow.push("layer2_after");
          return result;
        },
      });

      const layer3 = createMiddleware({
        name: "Layer3",
        wrapToolCall: async (request, handler) => {
          executionFlow.push("layer3_before");
          const result = await handler(request);
          executionFlow.push("layer3_after");
          return result;
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "test", args: {}, id: "1" }]],
      });

      const agent = createAgent({
        model,
        tools: [testTool],
        middleware: [layer1, layer2, layer3],
      });

      await agent.invoke({
        messages: [new HumanMessage("Test")],
      });

      // Verify correct nesting: layer1 -> layer2 -> layer3 -> tool
      expect(executionFlow).toEqual([
        "layer1_before",
        "layer2_before",
        "layer3_before",
        "tool",
        "layer3_after",
        "layer2_after",
        "layer1_after",
      ]);
    });

    it("supports setting responseFormat with wrapModelCall", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage(
            JSON.stringify({ answer: "The weather in Tokyo is 25°C" })
          ),
        ],
      });

      const middleware = createMiddleware({
        name: "DynamicPromptMiddleware",
        wrapModelCall: async (request, handler) => {
          const systemPrompt = "You are a helpful assistant.";
          return handler({ ...request, systemPrompt });
        },
      });

      const agent = createAgent({
        model,
        responseFormat: z.object({ answer: z.string() }),
        middleware: [middleware],
      });

      // Throws: "expected AIMessage, got object"
      const result = await agent.invoke({
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(result.structuredResponse).toEqual({
        answer: "The weather in Tokyo is 25°C",
      });
      const [human, assistant] = result.messages;
      expect(human.content).toBe("Hello");
      expect(assistant.content).toBe(
        JSON.stringify({ answer: "The weather in Tokyo is 25°C" })
      );
    });
  });

  describe("before/after agent hook", () => {
    it("should run before_agent and after_agent only once with multiple model calls", async () => {
      const executionLog: string[] = [];

      const sampleTool = tool(
        async ({ query }: { query: string }) => `Result for: ${query}`,
        {
          name: "sample_tool",
          description: "A sample tool for testing",
          schema: z.object({
            query: z.string(),
          }),
        }
      );

      const middleware = createMiddleware({
        name: "TestMiddleware",
        beforeAgent: async () => {
          executionLog.push("before_agent");
        },
        beforeModel: async () => {
          executionLog.push("before_model");
        },
        afterModel: async () => {
          executionLog.push("after_model");
        },
        afterAgent: async () => {
          executionLog.push("after_agent");
        },
      });

      // Model will call a tool twice, then respond with final answer
      // This creates 3 model invocations total, but agent hooks should still run once
      const model = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "sample_tool", args: { query: "first" }, id: "1" }],
          [{ name: "sample_tool", args: { query: "second" }, id: "2" }],
          [], // Third call returns no tool calls (final answer)
        ],
      });

      const agent = createAgent({
        model,
        tools: [sampleTool],
        middleware: [middleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Test")],
      });

      // Should see: before_agent once, then (before_model + after_model) 3 times, then after_agent once
      expect(executionLog).toEqual([
        "before_agent",
        "before_model",
        "after_model",
        "before_model",
        "after_model",
        "before_model",
        "after_model",
        "after_agent",
      ]);
    });

    it("should execute multiple before_agent and after_agent middleware in correct order", async () => {
      const executionLog: string[] = [];

      const middleware1 = createMiddleware({
        name: "Middleware1",
        beforeAgent: async () => {
          executionLog.push("before_agent_1");
        },
        afterAgent: async () => {
          executionLog.push("after_agent_1");
        },
      });

      const middleware2 = createMiddleware({
        name: "Middleware2",
        beforeAgent: async () => {
          executionLog.push("before_agent_2");
        },
        afterAgent: async () => {
          executionLog.push("after_agent_2");
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
        messages: [new HumanMessage("Test")],
      });

      // before_agent runs forward, after_agent runs in reverse
      expect(executionLog).toEqual([
        "before_agent_1",
        "before_agent_2",
        "after_agent_2",
        "after_agent_1",
      ]);
    });

    it("should allow state modifications in before and after agent hook", async () => {
      const middleware = createMiddleware({
        name: "TestMiddleware",
        stateSchema: z.object({
          customField: z.string().default("initial"),
        }),
        beforeAgent: async (state) => {
          expect(state.customField).toBe("initial");
          return {
            customField: "modified_by_before_agent",
          };
        },
        beforeModel: async (state) => {
          expect(state.customField).toBe("modified_by_before_agent");
        },
        afterAgent: async (state) => {
          expect(state.customField).toBe("modified_by_before_agent");
          return {
            customField: "modified_by_after_agent",
          };
        },
      });

      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Test")],
      });

      expect(result.customField).toBe("modified_by_after_agent");
    });

    it("should allow modifying structured response in after_agent hook", async () => {
      const responseSchema = z.object({
        answer: z.string(),
        confidence: z.number(),
      });

      const middleware = createMiddleware({
        name: "ResponseModifier",
        afterAgent: async (state) => {
          // Modify the structured response
          const currentResponse = (state as any).structuredResponse as {
            answer: string;
            confidence: number;
          };

          return {
            structuredResponse: {
              ...currentResponse,
              confidence: 0.95, // Override confidence
            },
          } as any;
        },
      });

      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              {
                name: "extract-1",
                args: { answer: "42", confidence: 0.5 },
                id: "call_1",
                type: "tool_call",
              },
            ],
          }),
        ],
      });

      const agent = createAgent({
        model,
        tools: [],
        responseFormat: toolStrategy(responseSchema),
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("What is the answer?")],
      });

      expect(result.structuredResponse).toEqual({
        answer: "42",
        confidence: 0.95, // Modified by after_agent hook
      });
    });

    it("should only allow middleware to modify its own state, not other middleware state", async () => {
      const middleware1 = createMiddleware({
        name: "Middleware1",
        stateSchema: z.object({
          field1: z.string().default("value1"),
        }),
        beforeAgent: async (state) => {
          // Should only see its own field, not field2 from middleware2
          expect(state).not.toHaveProperty("field2");
          return {
            field1: "modified1",
          };
        },
      });

      const middleware2 = createMiddleware({
        name: "Middleware2",
        stateSchema: z.object({
          field2: z.string().default("value2"),
        }),
        beforeAgent: async (state) => {
          // Should only see its own field, not field1 from middleware1
          expect(state).not.toHaveProperty("field1");
          return {
            field2: "modified2",
          };
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

      const result = await agent.invoke({
        messages: [new HumanMessage("Test")],
      });

      // Both fields should be in the final result
      expect(result.field1).toBe("modified1");
      expect(result.field2).toBe("modified2");
    });

    it("should not allow middleware to modify context in before_agent", async () => {
      const middleware = createMiddleware({
        name: "TestMiddleware",
        contextSchema: z.object({
          userId: z.string(),
        }),
        beforeAgent: async (_state, runtime) => {
          runtime.context.userId = "123user";
        },
      });

      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware],
      });

      await expect(
        agent.invoke(
          {
            messages: [new HumanMessage("Test")],
          },
          {
            context: { userId: "user123" },
          }
        )
      ).rejects.toThrow(
        "Cannot assign to read only property 'userId' of object '#<AgentContext>'"
      );
    });

    it("should support all hooks together with correct execution order", async () => {
      const executionLog: string[] = [];

      const sampleTool = tool(
        async ({ query }: { query: string }) => {
          executionLog.push("tool_execution");
          return `Result for: ${query}`;
        },
        {
          name: "sample_tool",
          description: "A sample tool",
          schema: z.object({
            query: z.string(),
          }),
        }
      );

      const middleware = createMiddleware({
        name: "FullMiddleware",
        beforeAgent: async () => {
          executionLog.push("before_agent");
        },
        beforeModel: async () => {
          executionLog.push("before_model");
        },
        afterModel: async () => {
          executionLog.push("after_model");
        },
        afterAgent: async () => {
          executionLog.push("after_agent");
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "sample_tool", args: { query: "test" }, id: "1" }],
          [], // Second call - no more tools
        ],
      });

      const agent = createAgent({
        model,
        tools: [sampleTool],
        middleware: [middleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Test")],
      });

      expect(executionLog).toEqual([
        "before_agent",
        "before_model",
        "after_model",
        "tool_execution",
        "before_model",
        "after_model",
        "after_agent",
      ]);
    });

    it("should preserve message additions in before_agent", async () => {
      const middleware = createMiddleware({
        name: "MessageModifier",
        beforeAgent: async (_state) => {
          return {
            messages: [new SystemMessage("Added by before_agent")],
          };
        },
      });

      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Original message")],
      });

      const messageContents = result.messages.map(
        (m: BaseMessage) => m.content
      );
      expect(messageContents).toContain("Added by before_agent");
      expect(messageContents).toContain("Original message");
    });

    it("should propagate state changes from before_agent through the entire agent execution", async () => {
      const middleware = createMiddleware({
        name: "StateTracker",
        stateSchema: z.object({
          trackedValue: z.string().default("initial"),
        }),
        beforeAgent: async () => {
          return {
            trackedValue: "set_in_before_agent",
          };
        },
        beforeModel: async (state) => {
          expect(state.trackedValue).toBe("set_in_before_agent");
        },
        afterModel: async (state) => {
          expect(state.trackedValue).toBe("set_in_before_agent");
        },
        afterAgent: async (state) => {
          expect(state.trackedValue).toBe("set_in_before_agent");
          return {
            trackedValue: "final_value",
          };
        },
      });

      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Test")],
      });

      expect(result.trackedValue).toBe("final_value");
    });

    it("hooks run before/after every invocation", async () => {
      const beforeAgentCall = vi.fn();
      const afterAgentCall = vi.fn();
      const middleware = createMiddleware({
        name: "CallTracker",
        beforeAgent: beforeAgentCall,
        afterAgent: afterAgentCall,
      });

      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware],
      });

      await agent.invoke({
        messages: "Test",
      });
      expect(beforeAgentCall).toHaveBeenCalledTimes(1);
      expect(afterAgentCall).toHaveBeenCalledTimes(1);

      await agent.invoke({
        messages: "Test2",
      });
      expect(beforeAgentCall).toHaveBeenCalledTimes(2);
      expect(afterAgentCall).toHaveBeenCalledTimes(2);

      await agent.invoke({
        messages: "Test3",
      });
      expect(beforeAgentCall).toHaveBeenCalledTimes(3);
      expect(afterAgentCall).toHaveBeenCalledTimes(3);
    });

    it("should jump to afterAgent when beforeAgent jumps to end", async () => {
      const executionLog: string[] = [];

      const middleware1 = createMiddleware({
        name: "Middleware1",
        beforeAgent: {
          hook: async () => {
            executionLog.push("before_agent_1");
            return {
              jumpTo: "end",
            };
          },
          canJumpTo: ["end"],
        },
        afterAgent: async () => {
          executionLog.push("after_agent_1");
        },
      });

      const middleware2 = createMiddleware({
        name: "Middleware2",
        beforeAgent: async () => {
          executionLog.push("before_agent_2");
        },
        afterAgent: async () => {
          executionLog.push("after_agent_2");
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

      const result = await agent.invoke({
        messages: [new HumanMessage("Test")],
      });

      // When beforeAgent jumps to "end", it should:
      // 1. Skip remaining beforeAgent hooks (beforeAgent_2 not called)
      // 2. Skip model execution
      // 3. Jump to afterAgent hooks (both afterAgent_2 and afterAgent_1 are called)
      expect(executionLog).toEqual([
        "before_agent_1",
        "after_agent_2",
        "after_agent_1",
      ]);

      // Verify that only the input message is in the result (no model response)
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toBe("Test");
    });

    it("should terminate when afterModel jumps to end (skips tools)", async () => {
      const executionLog: string[] = [];

      const toolFn = vi.fn(async ({ query }: { query: string }) => {
        executionLog.push("tool_execution");
        return `${query}`;
      });

      const sampleTool = tool(toolFn, {
        name: "sample_tool",
        description: "Sample tool",
        schema: z.object({
          query: z.string(),
        }),
      });

      const middleware = createMiddleware({
        name: "Middleware",
        afterModel: {
          hook: async () => {
            executionLog.push("after_model");
            return {
              jumpTo: "end",
            };
          },
          canJumpTo: ["end"],
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "sample_tool", args: { query: "Test" }, id: "test_id" }],
        ],
      });

      const agent = createAgent({
        model,
        tools: [sampleTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Test")],
      });

      expect(executionLog).toEqual(["after_model"]);
      expect(toolFn).not.toHaveBeenCalled();
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content).toBe("Test");
      expect(AIMessage.isInstance(result.messages[1])).toBe(true);
      expect((result.messages[1] as AIMessage).tool_calls?.length).toBe(1);
      expect(result.messages.some((m) => ToolMessage.isInstance(m))).toBe(
        false
      );
    });
  });
});
