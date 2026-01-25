/**
 * Tests for middleware error handling, particularly GraphInterrupt propagation.
 *
 * These tests verify that GraphInterrupt and other GraphBubbleUp errors
 * are not wrapped in MiddlewareError but bubble up unchanged.
 */
import { describe, it, expect, vi } from "vitest";
import { z } from "zod/v3";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { GraphInterrupt, MemorySaver } from "@langchain/langgraph";

import { createAgent, createMiddleware } from "../index.js";
import { FakeToolCallingModel } from "./utils.js";
import { MiddlewareError } from "../errors.js";

describe("Middleware Error Handling", () => {
  describe("GraphInterrupt propagation with checkpointer", () => {
    it("should preserve GraphInterrupt.interrupts property through middleware when using checkpointer", async () => {
      const checkpointer = new MemorySaver();
      const interruptValue = { action: "approve", data: { id: 123 } };

      const interruptTool = tool(
        async () => {
          throw new GraphInterrupt([{ value: interruptValue }]);
        },
        {
          name: "interrupt_tool",
          description: "A tool that throws a GraphInterrupt",
          schema: z.object({}),
        }
      );

      const middleware = createMiddleware({
        name: "testMiddleware",
        wrapToolCall: async (request, handler) => {
          // This middleware wraps the tool call - GraphInterrupt should pass through
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "interrupt_tool", args: {}, id: "call_1" }]],
      });

      const agent = createAgent({
        model,
        tools: [interruptTool],
        middleware: [middleware],
        checkpointer,
      });

      const config = { configurable: { thread_id: "test-single-middleware" } };

      // With checkpointer, GraphInterrupt returns in result.__interrupt__
      const result = await agent.invoke(
        { messages: [new HumanMessage("test")] },
        config
      );

      // Verify the interrupt is preserved with all properties
      expect(result.__interrupt__).toBeDefined();
      expect(result.__interrupt__?.length).toBe(1);
      expect(result.__interrupt__?.[0].value).toEqual(interruptValue);
    });

    it("should preserve GraphInterrupt through multiple middleware layers", async () => {
      const checkpointer = new MemorySaver();
      const interruptValue = { action: "approve", data: { id: 456 } };

      const interruptTool = tool(
        async () => {
          throw new GraphInterrupt([{ value: interruptValue }]);
        },
        {
          name: "interrupt_tool",
          description: "A tool that throws a GraphInterrupt",
          schema: z.object({}),
        }
      );

      // Multiple middleware layers - all should pass GraphInterrupt through unchanged
      const outerMiddleware = createMiddleware({
        name: "outerMiddleware",
        wrapToolCall: async (request, handler) => {
          return handler(request);
        },
      });

      const innerMiddleware = createMiddleware({
        name: "innerMiddleware",
        wrapToolCall: async (request, handler) => {
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "interrupt_tool", args: {}, id: "call_1" }]],
      });

      const agent = createAgent({
        model,
        tools: [interruptTool],
        middleware: [outerMiddleware, innerMiddleware],
        checkpointer,
      });

      const config = { configurable: { thread_id: "test-multi-middleware" } };

      const result = await agent.invoke(
        { messages: [new HumanMessage("test")] },
        config
      );

      // The interrupt should be preserved with all properties intact
      expect(result.__interrupt__).toBeDefined();
      expect(result.__interrupt__?.length).toBe(1);
      expect(result.__interrupt__?.[0].value).toEqual(interruptValue);
    });

    it("should preserve GraphInterrupt from nested subagent through parent middleware", async () => {
      const parentCheckpointer = new MemorySaver();
      const childCheckpointer = new MemorySaver();

      // Create inner agent that throws GraphInterrupt
      const innerInterruptTool = tool(
        async () => {
          throw new GraphInterrupt([{ value: "subagent-interrupt" }]);
        },
        {
          name: "inner_interrupt",
          description: "Inner tool that interrupts",
          schema: z.object({}),
        }
      );

      const innerModel = new FakeToolCallingModel({
        toolCalls: [[{ name: "inner_interrupt", args: {}, id: "inner_1" }]],
      });

      const innerMiddleware = createMiddleware({
        name: "innerMiddleware",
        wrapToolCall: async (request, handler) => {
          return handler(request);
        },
      });

      const innerAgent = createAgent({
        model: innerModel,
        tools: [innerInterruptTool],
        middleware: [innerMiddleware],
        checkpointer: childCheckpointer,
      });

      // Create outer agent with a tool that invokes the inner agent
      const subAgentTool = tool(
        async () => {
          // Inner agent invocation - will return with __interrupt__
          const result = await innerAgent.invoke(
            { messages: [new HumanMessage("trigger interrupt")] },
            { configurable: { thread_id: "inner-thread" } }
          );
          // If inner agent interrupted, propagate it
          if (result.__interrupt__) {
            throw new GraphInterrupt(result.__interrupt__);
          }
          return "success";
        },
        {
          name: "subagent_tool",
          description: "A tool that spawns a sub-agent",
          schema: z.object({}),
        }
      );

      const outerModel = new FakeToolCallingModel({
        toolCalls: [[{ name: "subagent_tool", args: {}, id: "outer_1" }]],
      });

      const outerMiddleware = createMiddleware({
        name: "outerMiddleware",
        wrapToolCall: async (request, handler) => {
          return handler(request);
        },
      });

      const outerAgent = createAgent({
        model: outerModel,
        tools: [subAgentTool],
        middleware: [outerMiddleware],
        checkpointer: parentCheckpointer,
      });

      const result = await outerAgent.invoke(
        { messages: [new HumanMessage("test")] },
        { configurable: { thread_id: "outer-thread" } }
      );

      // The GraphInterrupt from the inner agent should bubble up correctly
      expect(result.__interrupt__).toBeDefined();
      expect(result.__interrupt__?.length).toBe(1);
      expect(result.__interrupt__?.[0].value).toBe("subagent-interrupt");
    });

    it("should still wrap non-GraphBubbleUp errors in MiddlewareError", async () => {
      const errorTool = tool(
        async () => {
          throw new Error("regular error");
        },
        {
          name: "error_tool",
          description: "A tool that throws a regular error",
          schema: z.object({}),
        }
      );

      const middleware = createMiddleware({
        name: "testMiddleware",
        wrapToolCall: async (request, handler) => {
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "error_tool", args: {}, id: "call_1" }]],
      });

      const agent = createAgent({
        model,
        tools: [errorTool],
        middleware: [middleware],
      });

      try {
        await agent.invoke({ messages: [new HumanMessage("test")] });
        expect.fail("Should have thrown MiddlewareError");
      } catch (error) {
        // Regular errors should still be wrapped in MiddlewareError
        expect(error).toBeInstanceOf(MiddlewareError);
        expect((error as MiddlewareError).message).toBe("regular error");
        expect((error as MiddlewareError).cause).toBeInstanceOf(Error);
      }
    });

    it("should handle GraphInterrupt with checkpointer for resume flow", async () => {
      const checkpointer = new MemorySaver();
      const toolCalled = vi.fn();

      const interruptTool = tool(
        async () => {
          toolCalled();
          throw new GraphInterrupt([{ value: "needs-approval" }]);
        },
        {
          name: "interrupt_tool",
          description: "A tool that requires approval",
          schema: z.object({}),
        }
      );

      const middleware = createMiddleware({
        name: "testMiddleware",
        wrapToolCall: async (request, handler) => {
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "interrupt_tool", args: {}, id: "call_1" }], []],
      });

      const agent = createAgent({
        model,
        tools: [interruptTool],
        middleware: [middleware],
        checkpointer,
      });

      const config = { configurable: { thread_id: "test-resume-thread" } };

      // First invocation should interrupt
      const result = await agent.invoke(
        { messages: [new HumanMessage("test")] },
        config
      );

      // Verify the interrupt is in the result (not thrown as error when using checkpointer)
      expect(result.__interrupt__).toBeDefined();
      expect(result.__interrupt__?.length).toBe(1);
      expect(result.__interrupt__?.[0].value).toBe("needs-approval");
      expect(toolCalled).toHaveBeenCalledTimes(1);
    });
  });

  describe("MiddlewareError.wrap", () => {
    it("should return GraphInterrupt unchanged", () => {
      const interrupt = new GraphInterrupt([{ value: "test" }]);
      const wrapped = MiddlewareError.wrap(interrupt, "testMiddleware");

      expect(wrapped).toBe(interrupt);
      expect(wrapped).toBeInstanceOf(GraphInterrupt);
    });

    it("should wrap regular errors in MiddlewareError", () => {
      const error = new Error("test error");
      const wrapped = MiddlewareError.wrap(error, "testMiddleware");

      expect(wrapped).toBeInstanceOf(MiddlewareError);
      expect(wrapped.message).toBe("test error");
      expect((wrapped as MiddlewareError).cause).toBe(error);
    });

    it("should wrap non-Error values in MiddlewareError", () => {
      const wrapped = MiddlewareError.wrap("string error", "testMiddleware");

      expect(wrapped).toBeInstanceOf(MiddlewareError);
      expect(wrapped.message).toBe("string error");
    });
  });
});
