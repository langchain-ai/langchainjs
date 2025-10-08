import { expect, describe, it, vi } from "vitest";
import { tool } from "@langchain/core/tools";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { LanguageModelLike } from "@langchain/core/language_models/base";
import { z } from "zod/v3";

import { createAgent, createMiddleware } from "../index.js";
import { FakeToolCallingChatModel, FakeToolCallingModel } from "./utils.js";

function createMockModel(name = "ChatAnthropic", model = "anthropic") {
  // Mock Anthropic model
  const invokeCallback = vi
    .fn()
    .mockResolvedValue(new AIMessage("Response from model"));
  return {
    getName: () => name,
    bindTools: vi.fn().mockReturnThis(),
    _streamResponseChunks: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    invoke: invokeCallback,
    lc_runnable: true,
    _modelType: model,
    _generate: vi.fn(),
    _llmType: () => model,
  } as unknown as LanguageModelLike;
}

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

  describe("modifyModelRequest", () => {
    const tools = [
      tool(async () => "Tool response", {
        name: "toolA",
      }),
      tool(async () => "Tool response", {
        name: "toolB",
      }),
      tool(async () => "Tool response", {
        name: "toolC",
      }),
    ];

    it("should allow to add", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = createMockModel() as any;
      const middleware = createMiddleware({
        name: "middleware",
        tools: [
          tool(async () => "Tool response", {
            name: "toolD",
          }),
        ],
        modifyModelRequest: async (request) => {
          return {
            ...request,
            tools: request.tools.filter((tool) => tool.name === "toolD"),
            toolChoice: "required",
          };
        },
      });
      const agent = createAgent({
        model,
        tools,
        middleware: [middleware] as const,
      });
      await agent.invoke({
        messages: [new HumanMessage("Hello, world!")],
      });
      expect(model.bindTools).toHaveBeenCalledWith(
        [expect.objectContaining({ name: "toolD" })],
        {
          tool_choice: "required",
        }
      );
    });

    it("should throw if user adds a new tool", async () => {
      const model = createMockModel();
      const middleware = createMiddleware({
        name: "middleware",
        modifyModelRequest: async (request) => {
          return {
            ...request,
            tools: [
              ...request.tools,
              tool(async () => "Tool response", {
                name: "toolE",
              }),
            ],
          };
        },
      });
      const agent = createAgent({
        model,
        tools,
        middleware: [middleware] as const,
      });
      await expect(
        agent.invoke({ messages: [new HumanMessage("Hello, world!")] })
      ).rejects.toThrow(
        'You have added a new tool in "modifyModelRequest" hook of middleware "middleware": toolE. This is not supported.'
      );
    });

    it("should throw if user modifies a tool", async () => {
      const model = createMockModel();
      const middleware = createMiddleware({
        name: "middleware",
        modifyModelRequest: async (request) => {
          return {
            ...request,
            tools: request.tools.map((tool) => ({
              ...tool,
              description: "Modified tool",
            })),
          };
        },
      });
      const agent = createAgent({
        model,
        tools,
        middleware: [middleware] as const,
      });
      await expect(
        agent.invoke({ messages: [new HumanMessage("Hello, world!")] })
      ).rejects.toThrow(
        'You have modified a tool in "modifyModelRequest" hook of middleware "middleware": toolA, toolB, toolC. This is not supported.'
      );
    });
  });

  describe("retryModelRequest", () => {
    it("should retry the model request with the new model", async () => {
      const model = createMockModel();
      model.invoke = vi.fn().mockRejectedValue(new Error("Model error"));
      const retryModel = createMockModel("ChatAnthropic", "anthropic");
      const middleware = createMiddleware({
        name: "middleware",
        retryModelRequest: async (_, request) => {
          return {
            ...request,
            model: retryModel,
          };
        },
      });
      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware] as const,
      });
      await agent.invoke({ messages: [new HumanMessage("Hello, world!")] });
      expect(model.invoke).toHaveBeenCalledTimes(1);
      expect(retryModel.invoke).toHaveBeenCalledTimes(1);
    });

    it("should not retry the model request if the middleware returns undefined", async () => {
      const model = createMockModel();
      model.invoke = vi.fn().mockRejectedValue(new Error("Model error"));
      const retryModel = createMockModel("ChatAnthropic", "anthropic");
      const middleware = createMiddleware({
        name: "middleware",
        retryModelRequest: async () => {
          return;
        },
      });
      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware] as const,
      });
      await expect(
        agent.invoke({ messages: [new HumanMessage("Hello, world!")] })
      ).rejects.toThrow("Model error");
      expect(model.invoke).toHaveBeenCalledTimes(1);
      expect(retryModel.invoke).toHaveBeenCalledTimes(0);
    });

    it("should break after the first middleware that returns a request", async () => {
      const model = createMockModel();
      model.invoke = vi
        .fn()
        .mockRejectedValueOnce(new Error("Model error"))
        .mockResolvedValueOnce(new AIMessage("Response from model"));
      const retryModel = createMockModel("ChatAnthropic", "anthropic");
      const middleware1 = createMiddleware({
        name: "middleware1",
        retryModelRequest: async (_, request) => request,
      });
      const middleware2 = createMiddleware({
        name: "middleware2",
        retryModelRequest: async (_, request) => {
          return {
            ...request,
            model: retryModel,
          };
        },
      });
      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware1, middleware2] as const,
      });

      await agent.invoke({ messages: [new HumanMessage("Hello, world!")] });
      expect(model.invoke).toHaveBeenCalledTimes(2);
      expect(retryModel.invoke).toHaveBeenCalledTimes(0);
    });
  });
});
