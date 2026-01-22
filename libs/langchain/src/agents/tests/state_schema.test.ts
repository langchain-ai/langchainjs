/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, expectTypeOf } from "vitest";
import { z } from "zod";
import { z as z4 } from "zod/v4";
import { HumanMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { StateSchema, ReducedValue, Command } from "@langchain/langgraph";

import { createAgent, createMiddleware } from "../index.js";
import { FakeToolCallingModel } from "./utils.js";
import type { InferAgentState } from "../types.js";

describe("StateSchema support", () => {
  describe("basic functionality", () => {
    it("should accept StateSchema as stateSchema", () => {
      const AgentState = new StateSchema({
        userId: z.string(),
        count: z.number().default(0),
      });

      const agent = createAgent({
        model: new FakeToolCallingModel({ toolCalls: [] }),
        tools: [],
        stateSchema: AgentState,
      });

      expect(agent).toBeDefined();
      expect(agent.options.stateSchema).toBe(AgentState);
    });

    it("should accept StateSchema with ReducedValue fields", () => {
      const AgentState = new StateSchema({
        history: new ReducedValue(z.array(z.string()).default(() => []), {
          inputSchema: z.string(),
          reducer: (current, next) => [...current, next],
        }),
      });

      const agent = createAgent({
        model: new FakeToolCallingModel({ toolCalls: [] }),
        tools: [],
        stateSchema: AgentState,
      });

      expect(agent).toBeDefined();
    });

    it("should accept StateSchema with Zod v4 schemas", () => {
      const AgentState = new StateSchema({
        userId: z4.string(),
        count: z4.number().default(0),
      });

      const agent = createAgent({
        model: new FakeToolCallingModel({ toolCalls: [] }),
        tools: [],
        stateSchema: AgentState,
      });

      expect(agent).toBeDefined();
    });
  });

  describe("ReducedValue reducer invocation", () => {
    it("should invoke reducer when tool returns Command with state update", async () => {
      const reducerCalls: Array<{ current: string[]; next: string }> = [];

      const AgentState = new StateSchema({
        history: new ReducedValue(z.array(z.string()).default(() => []), {
          inputSchema: z.string(),
          reducer: (current, next) => {
            reducerCalls.push({ current: [...current], next });
            return [...current, next];
          },
        }),
      });

      const addHistoryTool = tool(
        async ({ entry }) => {
          return new Command({
            update: {
              history: entry,
              messages: [
                new ToolMessage({
                  content: `Added: ${entry}`,
                  tool_call_id: "1",
                }),
              ],
            },
          });
        },
        {
          name: "add_history",
          description: "Add an entry to history",
          schema: z.object({
            entry: z.string().describe("The entry to add"),
          }),
        }
      );

      const model = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "add_history", args: { entry: "first_entry" }, id: "1" }],
        ],
      });

      const agent = createAgent({
        model,
        tools: [addHistoryTool],
        stateSchema: AgentState,
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Add an entry")],
        history: "initial",
      });

      // Verify reducer was actually called
      expect(reducerCalls.length).toBeGreaterThan(0);
      expect(reducerCalls).toContainEqual({
        current: ["initial"],
        next: "first_entry",
      });

      // Verify final state
      expect(result.history).toEqual(["initial", "first_entry"]);
    });

    it("should invoke reducer multiple times for multiple tool calls", async () => {
      const reducerCalls: Array<{ current: string[]; next: string }> = [];

      const AgentState = new StateSchema({
        tasks: new ReducedValue(z.array(z.string()).default(() => []), {
          inputSchema: z.string(),
          reducer: (current, next) => {
            reducerCalls.push({ current: [...current], next });
            return [...current, next];
          },
        }),
      });

      const addTaskTool = tool(
        async ({ taskName }, config) => {
          return new Command({
            update: {
              tasks: taskName,
              messages: [
                new ToolMessage({
                  content: `Added task: ${taskName}`,
                  tool_call_id: config.toolCall?.id ?? "unknown",
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
        stateSchema: AgentState,
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Add two tasks")],
        tasks: "Initial Task",
      });

      // Verify reducer was called for each task
      expect(reducerCalls.length).toBeGreaterThanOrEqual(2);

      // Verify final state contains all tasks
      expect(result.tasks).toEqual(["Initial Task", "Task A", "Task B"]);
    });
  });

  describe("middleware integration with StateSchema", () => {
    it("should invoke reducer through middleware beforeModel hook", async () => {
      const reducerCalls: Array<{ current: string[]; next: string }> = [];

      const AgentState = new StateSchema({
        history: new ReducedValue(z.array(z.string()).default(() => []), {
          inputSchema: z.string(),
          reducer: (current, next) => {
            reducerCalls.push({ current: [...current], next });
            return [...current, next];
          },
        }),
      });

      const middleware = createMiddleware({
        name: "HistoryMiddleware",
        beforeModel: async () => {
          return {
            history: "from_beforeModel",
          } as any;
        },
        afterModel: async () => {
          return {
            history: "from_afterModel",
          } as any;
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [],
      });

      const agent = createAgent({
        model,
        tools: [],
        stateSchema: AgentState,
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Test middleware")],
        history: "initial",
      });

      // Verify reducer was called from middleware hooks
      expect(reducerCalls.length).toBeGreaterThanOrEqual(2);
      expect(reducerCalls).toContainEqual({
        current: ["initial"],
        next: "from_beforeModel",
      });
      expect(reducerCalls).toContainEqual({
        current: ["initial", "from_beforeModel"],
        next: "from_afterModel",
      });

      // Verify final state
      expect(result.history).toEqual([
        "initial",
        "from_beforeModel",
        "from_afterModel",
      ]);
    });

    it("should invoke reducer through wrapToolCall returning Command", async () => {
      const reducerCalls: Array<{ current: string[]; next: string }> = [];

      const AgentState = new StateSchema({
        auditLog: new ReducedValue(z.array(z.string()).default(() => []), {
          inputSchema: z.string(),
          reducer: (current, next) => {
            reducerCalls.push({ current: [...current], next });
            return [...current, next];
          },
        }),
      });

      const dummyTool = tool(async () => "tool executed", {
        name: "dummy_tool",
        description: "A dummy tool for testing",
        schema: z.object({}),
      });

      const middleware = createMiddleware({
        name: "AuditMiddleware",
        wrapToolCall: async (request) => {
          return new Command({
            update: {
              auditLog: `tool_called:${request.toolCall.name}`,
              messages: [
                new ToolMessage({
                  content: "Intercepted by middleware",
                  tool_call_id: request.toolCall.id!,
                }),
              ],
            },
          });
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "dummy_tool", args: {}, id: "1" }]],
      });

      const agent = createAgent({
        model,
        tools: [dummyTool],
        stateSchema: AgentState,
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Test wrapToolCall Command")],
        auditLog: "initial",
      });

      // Verify reducer was called from wrapToolCall Command
      expect(reducerCalls.length).toBeGreaterThan(0);
      expect(reducerCalls).toContainEqual({
        current: ["initial"],
        next: "tool_called:dummy_tool",
      });

      // Verify final state
      expect(result.auditLog).toEqual(["initial", "tool_called:dummy_tool"]);
    });

    it("should work with middleware that has its own stateSchema alongside agent StateSchema", async () => {
      const agentReducerCalls: Array<{ current: string[]; next: string }> = [];

      const AgentState = new StateSchema({
        events: new ReducedValue(z.array(z.string()).default(() => []), {
          inputSchema: z.string(),
          reducer: (current, next) => {
            agentReducerCalls.push({ current: [...current], next });
            return [...current, next];
          },
        }),
      });

      const middleware = createMiddleware({
        name: "TrackerMiddleware",
        stateSchema: z.object({
          requestCount: z.number().default(0),
        }),
        beforeModel: async (state) => {
          return {
            events: "model_request_started",
            requestCount: (state.requestCount ?? 0) + 1,
          } as any;
        },
        afterModel: async () => {
          return {
            events: "model_request_completed",
          } as any;
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [],
      });

      const agent = createAgent({
        model,
        tools: [],
        stateSchema: AgentState,
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Test combined schemas")],
        requestCount: 0,
        events: "initial",
      });

      // Verify agent's reducer was called
      expect(agentReducerCalls.length).toBeGreaterThanOrEqual(2);

      // Verify final state includes both agent and middleware state
      expect(result.events).toContain("model_request_started");
      expect(result.events).toContain("model_request_completed");
      expect(result.requestCount).toBe(1);
    });
  });

  describe("state preservation", () => {
    it("should preserve custom state values through agent execution", async () => {
      const AgentState = new StateSchema({
        userId: z.string(),
        sessionId: z.string(),
        counter: z.number().default(0),
      });

      const agent = createAgent({
        model: new FakeToolCallingModel({ toolCalls: [] }),
        tools: [],
        stateSchema: AgentState,
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("test")],
        userId: "user-123",
        sessionId: "session-456",
        counter: 5,
      });

      expect(result.userId).toBe("user-123");
      expect(result.sessionId).toBe("session-456");
      expect(result.counter).toBe(5);
    });

    it("should use default values when not provided", async () => {
      const AgentState = new StateSchema({
        count: z.number().default(42),
        name: z.string().default("default-name"),
      });

      const agent = createAgent({
        model: new FakeToolCallingModel({ toolCalls: [] }),
        tools: [],
        stateSchema: AgentState,
      });

      // Cast to any to test runtime default behavior
      // (TypeScript doesn't fully understand optional defaults from StateSchema)
      const result = await agent.invoke({
        messages: [new HumanMessage("test")],
      } as any);

      expect(result.count).toBe(42);
      expect(result.name).toBe("default-name");
    });
  });

  describe("type inference", () => {
    it("should have proper result structure with StateSchema", async () => {
      const AgentState = new StateSchema({
        userId: z.string(),
        count: z.number().default(0),
      });

      const agent = createAgent({
        model: new FakeToolCallingModel({ toolCalls: [] }),
        tools: [],
        stateSchema: AgentState,
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("test")],
        userId: "user-123",
        count: 5,
      });

      // Verify the result has expected properties at runtime
      expect(result).toHaveProperty("messages");
      expect(result).toHaveProperty("userId");
      expect(result).toHaveProperty("count");

      // Verify types using expectTypeOf
      expectTypeOf(result).toHaveProperty("messages");
      expectTypeOf(result.messages).toExtend<BaseMessage[]>();
    });

    it("should have proper result structure with ReducedValue", async () => {
      const AgentState = new StateSchema({
        history: new ReducedValue(z.array(z.string()).default(() => []), {
          inputSchema: z.string(),
          reducer: (current, next) => [...current, next],
        }),
      });

      const agent = createAgent({
        model: new FakeToolCallingModel({ toolCalls: [] }),
        tools: [],
        stateSchema: AgentState,
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("test")],
        history: "initial",
      });

      // Verify history is an array at runtime
      expect(Array.isArray(result.history)).toBe(true);
    });

    it("should properly merge StateSchema with middleware stateSchema types", async () => {
      const AgentState = new StateSchema({
        agentField: z.string(),
      });

      const middleware = createMiddleware({
        name: "TestMiddleware",
        stateSchema: z.object({
          middlewareField: z.number().default(0),
        }),
      });

      const agent = createAgent({
        model: new FakeToolCallingModel({ toolCalls: [] }),
        tools: [],
        stateSchema: AgentState,
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("test")],
        agentField: "value",
        middlewareField: 42,
      });

      // Both agent and middleware fields should be present
      expect(result).toHaveProperty("agentField");
      expect(result).toHaveProperty("middlewareField");
      expect(result.agentField).toBe("value");
      expect(result.middlewareField).toBe(42);
    });

    it("should infer agent state type using InferAgentState", () => {
      const AgentState = new StateSchema({
        userId: z.string(),
        sessionData: z.object({
          token: z.string(),
          expiresAt: z.number(),
        }),
      });

      const agent = createAgent({
        model: new FakeToolCallingModel({ toolCalls: [] }),
        tools: [],
        stateSchema: AgentState,
      });

      type AgentStateType = InferAgentState<typeof agent>;

      // Type-level check that custom fields are present
      expectTypeOf<AgentStateType>().toHaveProperty("userId");
      expectTypeOf<AgentStateType>().toHaveProperty("sessionData");
    });

    it("should support StateSchema with responseFormat", async () => {
      const AgentState = new StateSchema({
        customField: z.string(),
      });

      const responseFormat = z.object({
        answer: z.string(),
        confidence: z.number(),
      });

      const agent = createAgent({
        model: new FakeToolCallingModel({
          toolCalls: [
            [
              {
                name: "extract-1",
                args: { answer: "test", confidence: 0.9 },
                id: "extract",
              },
            ],
          ],
          structuredResponse: { answer: "test", confidence: 0.9 },
        }),
        tools: [],
        stateSchema: AgentState,
        responseFormat,
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("test")],
        customField: "value",
      });

      // Verify both custom state and structured response
      expect(result.customField).toBe("value");
      expect(result).toHaveProperty("structuredResponse");
    });
  });
});
