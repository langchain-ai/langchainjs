import { z } from "zod/v3";
import { z as z4 } from "zod/v4";
import { describe, it, expect } from "vitest";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { registry } from "@langchain/langgraph/zod";
import { Command } from "@langchain/langgraph";

import { createMiddleware, createAgent } from "../index.js";
import { FakeToolCallingModel } from "./utils.js";

describe("middleware state management", () => {
  it("should allow to define private state props with _ that doesn't leak out", async () => {
    expect.assertions(16);
    const model = new FakeToolCallingModel({
      toolCalls: [
        [{ name: "get_weather", args: { location: "Tokyo" }, id: "1" }],
      ],
    });

    /**
     * Track which hooks have been run so we don't run assertions twice.
     */
    const hooksRun = new Set<string>();

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
        if (hooksRun.has("middlewareA_beforeModel")) {
          return;
        }
        hooksRun.add("middlewareA_beforeModel");

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
      wrapToolCall: async (request, handler) => {
        if (hooksRun.has("middlewareA_wrapToolCall")) {
          return handler(request);
        }
        hooksRun.add("middlewareA_wrapToolCall");

        const { messages, ...rest } = request.state;
        expect(rest).toEqual({
          middlewareABeforeModelState: "middlewareABeforeModelState",
          middlewareAAfterModelState: "middlewareAAfterModelState",
          _privateMiddlewareAState: "privateMiddlewareAState",
        });
        return handler(request);
      },
      wrapModelCall: async (request, handler) => {
        if (hooksRun.has("middlewareA_wrapModelCall")) {
          return handler(request);
        }
        hooksRun.add("middlewareA_wrapModelCall");

        const { messages, ...rest } = request.state;
        expect(rest).toEqual({
          middlewareABeforeModelState: "middlewareABeforeModelState",
          middlewareAAfterModelState: "AAfter",
          _privateMiddlewareAState: "privateMiddlewareAState",
        });
        return handler(request);
      },
      afterModel: async (state) => {
        if (hooksRun.has("middlewareA_afterModel")) {
          return;
        }
        hooksRun.add("middlewareA_afterModel");
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
        if (hooksRun.has("middlewareB_beforeModel")) {
          return;
        }
        hooksRun.add("middlewareB_beforeModel");
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
      wrapModelCall: async (request, handler) => {
        if (hooksRun.has("middlewareB_wrapModelCall")) {
          return handler(request);
        }
        hooksRun.add("middlewareB_wrapModelCall");
        const { messages, ...rest } = request.state;
        expect(rest).toEqual({
          middlewareBBeforeModelState: "middlewareBBeforeModelState",
          middlewareBAfterModelState: "BAfter",
          _privateMiddlewareBState: "privateMiddlewareBState",
        });
        return handler(request);
      },
      wrapToolCall: async (request, handler) => {
        if (hooksRun.has("middlewareB_wrapToolCall")) {
          return handler(request);
        }
        hooksRun.add("middlewareB_wrapToolCall");
        const { messages, ...rest } = request.state;
        expect(rest).toEqual({
          middlewareBBeforeModelState: "middlewareBBeforeModelState",
          middlewareBAfterModelState: "BAfter",
          _privateMiddlewareBState: "privateMiddlewareBState",
        });
        return handler(request);
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
      wrapModelCall: async (request, handler) => {
        if (hooksRun.has("middlewareC_wrapModelCall")) {
          return handler(request);
        }
        hooksRun.add("middlewareC_wrapModelCall");
        const { messages, ...rest } = request.state;
        expect(rest).toEqual({
          middlewareCBeforeModelState: "CBefore",
          middlewareCAfterModelState: "CAfter",
        });
        return handler(request);
      },
      wrapToolCall: async (request, handler) => {
        if (hooksRun.has("middlewareC_wrapToolCall")) {
          return handler(request);
        }
        hooksRun.add("middlewareC_wrapToolCall");
        const { messages, ...rest } = request.state;
        expect(rest).toEqual({
          middlewareCBeforeModelState: "CBefore",
          middlewareCAfterModelState: "middlewareCAfterModelState",
          _privateMiddlewareCState: "privateMiddlewareCState",
        });
        return handler(request);
      },
      afterModel: async (state) => {
        if (hooksRun.has("middlewareC_afterModel")) {
          return;
        }
        hooksRun.add("middlewareC_afterModel");
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

    const weatherTool = tool(
      async ({ location }: { location: string }) => {
        return `The weather in ${location} is sunny`;
      },
      {
        name: "get_weather",
        description: "Get the weather in a location",
        schema: z.object({
          location: z.string(),
        }),
      }
    );

    const agent = createAgent({
      model,
      tools: [weatherTool],
      middleware: [middlewareA, middlewareB, middlewareC],
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

    expect(messages).toHaveLength(3);
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

describe("state schema reducer preservation", () => {
  it("should preserve Zod v4 reducer metadata when converting to v3-compatible schema", async () => {
    const stateSchema = z4.object({
      tasks: z4
        .array(z4.string())
        .default([])
        .register(registry, {
          reducer: {
            fn: (
              existing: string[],
              incoming: string | string[] | undefined
            ) => {
              if (incoming === undefined) return existing;
              const incomingArray = Array.isArray(incoming)
                ? incoming
                : [incoming];
              return [...existing, ...incomingArray];
            },
          },
          default: () => [] as string[],
        }),
    });

    const addTaskTool = tool(
      async ({ taskName }) => {
        return new Command({
          update: {
            tasks: taskName,
            messages: [
              new ToolMessage({
                content: `Added task: ${taskName}`,
                tool_call_id: "test",
              }),
            ],
          },
        });
      },
      {
        name: "add_task",
        description: "Add a task to the list",
        schema: z.object({
          taskName: z.string().describe("The name of the task to add"),
        }),
        returnDirect: false,
      }
    );

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          { name: "add_task", args: { taskName: "Task A" }, id: "1" },
          { name: "add_task", args: { taskName: "Task B" }, id: "2" },
        ],
      ],
    });

    const agent = createAgent({
      model,
      tools: [addTaskTool],
      stateSchema,
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Add two tasks")],
      tasks: ["Initial Task"],
    });

    expect(result.tasks).toEqual(["Initial Task", "Task A", "Task B"]);
  });
});
