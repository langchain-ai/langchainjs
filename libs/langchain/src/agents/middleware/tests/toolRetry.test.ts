/**
 * Tests for ToolRetryMiddleware functionality.
 */

import { describe, it, expect } from "vitest";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v3";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { performance } from "node:perf_hooks";

import { createAgent, createMiddleware } from "../../index.js";
import { toolRetryMiddleware } from "../toolRetry.js";
import { calculateRetryDelay } from "../utils.js";
import { FakeToolCallingModel } from "../../tests/utils.js";
import { InvalidRetryConfigError } from "../error.js";

// Helper tools for testing

const workingTool = tool(
  async ({ input }) => {
    return `Success: ${input}`;
  },
  {
    name: "working_tool",
    description: "Tool that always succeeds",
    schema: z.object({
      input: z.string(),
    }),
  }
);

const failingTool = tool(
  async ({ input }) => {
    throw new Error(`Failed: ${input}`);
  },
  {
    name: "failing_tool",
    description: "Tool that always fails",
    schema: z.object({
      input: z.string(),
    }),
  }
);

/**
 * Helper function to create a tool that fails a certain number of times before succeeding.
 * Uses closure state to track attempts.
 */
function createTemporaryFailureTool(failCount: number) {
  let attempt = 0;

  return tool(
    async ({ input }) => {
      attempt += 1;
      if (attempt <= failCount) {
        throw new Error(`Temporary failure ${attempt}`);
      }
      return `Success after ${attempt} attempts: ${input}`;
    },
    {
      name: "temp_failing_tool",
      description: "Tool that fails temporarily",
      schema: z.object({
        input: z.string(),
      }),
    }
  );
}

// Custom error types for testing
class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

class HTTPError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "HTTPError";
    this.statusCode = statusCode;
  }
}

describe("toolRetryMiddleware", () => {
  describe("Initialization", () => {
    it("should initialize with default values", () => {
      const retry = toolRetryMiddleware();
      expect(retry).toBeDefined();
      expect(retry.name).toBe("toolRetryMiddleware");
    });

    it("should initialize with custom values", () => {
      const retry = toolRetryMiddleware({
        maxRetries: 5,
        tools: ["tool1", "tool2"],
        retryOn: [TimeoutError, NetworkError],
        onFailure: "error",
        backoffFactor: 1.5,
        initialDelayMs: 500,
        maxDelayMs: 30000,
        jitter: false,
      });
      expect(retry).toBeDefined();
      expect(retry.name).toBe("toolRetryMiddleware");
      // Note: Internal values are captured in closures and not directly accessible
    });

    it("should initialize with BaseTool instances", () => {
      const retry = toolRetryMiddleware({
        maxRetries: 3,
        tools: [workingTool, failingTool], // Pass BaseTool instances
      });
      expect(retry).toBeDefined();
      expect(retry.name).toBe("toolRetryMiddleware");
    });

    it("should initialize with mixed tool types", () => {
      const retry = toolRetryMiddleware({
        maxRetries: 2,
        tools: [workingTool, "failing_tool"], // Mix of BaseTool and string
      });
      expect(retry).toBeDefined();
      expect(retry.name).toBe("toolRetryMiddleware");
    });
  });

  describe("Validation", () => {
    it("should throw InvalidRetryConfigError for invalid maxRetries", () => {
      try {
        toolRetryMiddleware({ maxRetries: -1 });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidRetryConfigError);
        expect((error as InvalidRetryConfigError).message).toContain(
          "Number must be greater than or equal to 0"
        );
        expect((error as InvalidRetryConfigError).cause.issues[0].path).toEqual(
          ["maxRetries"]
        );
        expect((error as InvalidRetryConfigError).cause.issues[0].code).toBe(
          "too_small"
        );
      }
    });

    it("should throw InvalidRetryConfigError for invalid initialDelayMs", () => {
      try {
        toolRetryMiddleware({ initialDelayMs: -1 });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidRetryConfigError);
        expect((error as InvalidRetryConfigError).message).toContain(
          "Number must be greater than or equal to 0"
        );
        expect((error as InvalidRetryConfigError).cause.issues[0].path).toEqual(
          ["initialDelayMs"]
        );
        expect((error as InvalidRetryConfigError).cause.issues[0].code).toBe(
          "too_small"
        );
      }
    });

    it("should throw InvalidRetryConfigError for invalid maxDelayMs", () => {
      try {
        toolRetryMiddleware({ maxDelayMs: -1 });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidRetryConfigError);
        expect((error as InvalidRetryConfigError).message).toContain(
          "Number must be greater than or equal to 0"
        );
        expect((error as InvalidRetryConfigError).cause.issues[0].path).toEqual(
          ["maxDelayMs"]
        );
        expect((error as InvalidRetryConfigError).cause.issues[0].code).toBe(
          "too_small"
        );
      }
    });

    it("should throw InvalidRetryConfigError for invalid backoffFactor", () => {
      try {
        toolRetryMiddleware({ backoffFactor: -1 });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidRetryConfigError);
        expect((error as InvalidRetryConfigError).message).toContain(
          "Number must be greater than or equal to 0"
        );
        expect((error as InvalidRetryConfigError).cause.issues[0].path).toEqual(
          ["backoffFactor"]
        );
        expect((error as InvalidRetryConfigError).cause.issues[0].code).toBe(
          "too_small"
        );
      }
    });

    it("should throw InvalidRetryConfigError for invalid type (string instead of number)", () => {
      try {
        // @ts-expect-error - intentionally passing wrong type
        toolRetryMiddleware({ maxRetries: "not a number" });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidRetryConfigError);
        expect((error as InvalidRetryConfigError).cause.issues[0].path).toEqual(
          ["maxRetries"]
        );
        expect((error as InvalidRetryConfigError).cause.issues[0].code).toBe(
          "invalid_type"
        );
      }
    });
  });

  describe("Basic functionality", () => {
    it("should not retry working tool (no retry needed)", async () => {
      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              name: "working_tool",
              args: { input: "test" },
              id: "1",
            },
          ],
          [],
        ],
      });

      const retry = toolRetryMiddleware({
        maxRetries: 2,
        initialDelayMs: 10,
        jitter: false,
      });

      const agent = createAgent({
        model,
        tools: [workingTool],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Use working tool")] },
        { configurable: { thread_id: "test" } }
      );

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages).toHaveLength(1);
      expect(toolMessages[0].content).toContain("Success: test");
      expect(toolMessages[0].status).not.toBe("error");
    });

    it("should retry failing tool and return error message", async () => {
      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              name: "failing_tool",
              args: { input: "test" },
              id: "1",
            },
          ],
          [],
        ],
      });

      const retry = toolRetryMiddleware({
        maxRetries: 2,
        initialDelayMs: 10,
        jitter: false,
        onFailure: "continue",
      });

      const agent = createAgent({
        model,
        tools: [failingTool],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Use failing tool")] },
        { configurable: { thread_id: "test" } }
      );

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages).toHaveLength(1);
      // Should contain error message with tool name and attempts
      expect(toolMessages[0].content).toContain("failing_tool");
      expect(toolMessages[0].content).toContain("3 attempts");
      expect(toolMessages[0].content).toContain("Error");
      expect(toolMessages[0].status).toBe("error");
    });

    it("should retry failing tool and re-raise on failure", async () => {
      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              name: "failing_tool",
              args: { input: "test" },
              id: "1",
            },
          ],
          [],
        ],
      });

      const retry = toolRetryMiddleware({
        maxRetries: 2,
        initialDelayMs: 10,
        jitter: false,
        onFailure: "error",
      });

      const agent = createAgent({
        model,
        tools: [failingTool],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      // Should raise the Error from the tool
      await expect(
        agent.invoke(
          { messages: [new HumanMessage("Use failing tool")] },
          { configurable: { thread_id: "test" } }
        )
      ).rejects.toThrow("Failed: test");
    });

    it("should use custom failure formatter", async () => {
      const customFormatter = (error: Error): string => {
        return `Custom error: ${error.constructor.name}`;
      };

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              name: "failing_tool",
              args: { input: "test" },
              id: "1",
            },
          ],
          [],
        ],
      });

      const retry = toolRetryMiddleware({
        maxRetries: 1,
        initialDelayMs: 10,
        jitter: false,
        onFailure: customFormatter,
      });

      const agent = createAgent({
        model,
        tools: [failingTool],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Use failing tool")] },
        { configurable: { thread_id: "test" } }
      );

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages).toHaveLength(1);
      expect(toolMessages[0].content).toContain("Custom error: Error");
    });

    it("should succeed after temporary failures", async () => {
      const tempFailingTool = createTemporaryFailureTool(2);

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              name: "temp_failing_tool",
              args: { input: "test" },
              id: "1",
            },
          ],
          [],
        ],
      });

      const retry = toolRetryMiddleware({
        maxRetries: 3,
        initialDelayMs: 10,
        jitter: false,
      });

      const agent = createAgent({
        model,
        tools: [tempFailingTool],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Use temp failing tool")] },
        { configurable: { thread_id: "test" } }
      );

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages).toHaveLength(1);
      // Should succeed on 3rd attempt
      expect(toolMessages[0].content).toContain("Success after 3 attempts");
      expect(toolMessages[0].status).not.toBe("error");
    });
  });

  describe("Tool filtering", () => {
    it("should only apply to specific tools", async () => {
      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              name: "failing_tool",
              args: { input: "test1" },
              id: "1",
            },
            {
              name: "working_tool",
              args: { input: "test2" },
              id: "2",
            },
          ],
          [],
        ],
      });

      // Only retry failing_tool
      const retry = toolRetryMiddleware({
        maxRetries: 2,
        tools: ["failing_tool"],
        initialDelayMs: 10,
        jitter: false,
        onFailure: "continue",
      });

      const agent = createAgent({
        model,
        tools: [failingTool, workingTool],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Use both tools")] },
        { configurable: { thread_id: "test" } }
      );

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages).toHaveLength(2);

      // failing_tool should have error message
      const failingMsg = toolMessages.find((m) => m.name === "failing_tool");
      expect(failingMsg).toBeDefined();
      expect(failingMsg!.status).toBe("error");
      expect(failingMsg!.content).toContain("3 attempts");

      // working_tool should succeed normally (no retry applied)
      const workingMsg = toolMessages.find((m) => m.name === "working_tool");
      expect(workingMsg).toBeDefined();
      expect(workingMsg!.content).toContain("Success: test2");
      expect(workingMsg!.status).not.toBe("error");
    });

    it("should accept BaseTool instances for filtering", async () => {
      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              name: "failing_tool",
              args: { input: "test1" },
              id: "1",
            },
            {
              name: "working_tool",
              args: { input: "test2" },
              id: "2",
            },
          ],
          [],
        ],
      });

      // Only retry failing_tool, passed as BaseTool instance
      const retry = toolRetryMiddleware({
        maxRetries: 2,
        tools: [failingTool], // Pass BaseTool instance
        initialDelayMs: 10,
        jitter: false,
        onFailure: "continue",
      });

      const agent = createAgent({
        model,
        tools: [failingTool, workingTool],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Use both tools")] },
        { configurable: { thread_id: "test" } }
      );

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages).toHaveLength(2);

      // failing_tool should have error message (with retries)
      const failingMsg = toolMessages.find((m) => m.name === "failing_tool");
      expect(failingMsg).toBeDefined();
      expect(failingMsg!.status).toBe("error");
      expect(failingMsg!.content).toContain("3 attempts");

      // working_tool should succeed normally (no retry applied)
      const workingMsg = toolMessages.find((m) => m.name === "working_tool");
      expect(workingMsg).toBeDefined();
      expect(workingMsg!.content).toContain("Success: test2");
      expect(workingMsg!.status).not.toBe("error");
    });

    it("should reject invalid tool instances for filtering", () => {
      expect(() => {
        toolRetryMiddleware({
          tools: [{ foo: "bar" }],
        });
      }).toThrow(
        "Expected a tool name string or tool instance to be passed to toolRetryMiddleware"
      );
    });
  });

  describe("Exception filtering", () => {
    it("should only retry specific exception types (array)", async () => {
      const timeoutTool = tool(
        async ({ input }: { input: string }) => {
          throw new TimeoutError(`Timeout: ${input}`);
        },
        {
          name: "timeout_tool",
          description: "Tool that raises TimeoutError",
          schema: z.object({
            input: z.string(),
          }),
        }
      );

      const networkTool = tool(
        async ({ input }: { input: string }) => {
          throw new NetworkError(`Network: ${input}`);
        },
        {
          name: "network_tool",
          description: "Tool that raises NetworkError",
          schema: z.object({
            input: z.string(),
          }),
        }
      );

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              name: "timeout_tool",
              args: { input: "test1" },
              id: "1",
            },
            {
              name: "network_tool",
              args: { input: "test2" },
              id: "2",
            },
          ],
          [],
        ],
      });

      // Only retry TimeoutError
      const retry = toolRetryMiddleware({
        maxRetries: 2,
        retryOn: [TimeoutError],
        initialDelayMs: 10,
        jitter: false,
        onFailure: "continue",
      });

      const agent = createAgent({
        model,
        tools: [timeoutTool, networkTool],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Use both tools")] },
        { configurable: { thread_id: "test" } }
      );

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages).toHaveLength(2);

      // timeout_tool should have retried (3 attempts)
      const timeoutMsg = toolMessages.find((m) => m.name === "timeout_tool");
      expect(timeoutMsg).toBeDefined();
      expect(timeoutMsg!.status).toBe("error");
      expect(timeoutMsg!.content).toContain("3 attempts");
      expect(timeoutMsg!.content).toContain("TimeoutError");

      // network_tool should fail immediately (1 attempt only)
      const networkMsg = toolMessages.find((m) => m.name === "network_tool");
      expect(networkMsg).toBeDefined();
      expect(networkMsg!.status).toBe("error");
      expect(networkMsg!.content).toContain("1 attempt");
      expect(networkMsg!.content).toContain("NetworkError");
    });

    it("should only retry specific exception types (function)", async () => {
      const shouldRetry = (error: Error): boolean => {
        // Only retry on 5xx errors
        if (error.constructor === HTTPError) {
          return (
            500 <= (error as HTTPError).statusCode &&
            (error as HTTPError).statusCode < 600
          );
        }
        return false;
      };

      const http500Tool = tool(
        async ({ input }) => {
          throw new HTTPError(`Server error: ${input}`, 500);
        },
        {
          name: "http_500_tool",
          description: "Tool that raises 500 error",
          schema: z.object({
            input: z.string(),
          }),
        }
      );

      const http400Tool = tool(
        async ({ input }) => {
          throw new HTTPError(`Client error: ${input}`, 400);
        },
        {
          name: "http_400_tool",
          description: "Tool that raises 400 error",
          schema: z.object({
            input: z.string(),
          }),
        }
      );

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              name: "http_500_tool",
              args: { input: "test1" },
              id: "1",
            },
            {
              name: "http_400_tool",
              args: { input: "test2" },
              id: "2",
            },
          ],
          [],
        ],
      });

      const retry = toolRetryMiddleware({
        maxRetries: 2,
        retryOn: shouldRetry,
        initialDelayMs: 10,
        jitter: false,
        onFailure: "continue",
      });

      const agent = createAgent({
        model,
        tools: [http500Tool, http400Tool],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Use both tools")] },
        { configurable: { thread_id: "test" } }
      );

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages).toHaveLength(2);

      // http_500_tool should have retried (3 attempts)
      const msg500 = toolMessages.find((m) => m.name === "http_500_tool");
      expect(msg500).toBeDefined();
      expect(msg500!.status).toBe("error");
      expect(msg500!.content).toContain("3 attempts");
      expect(msg500!.content).toContain("HTTPError");

      // http_400_tool should fail immediately (1 attempt only)
      const msg400 = toolMessages.find((m) => m.name === "http_400_tool");
      expect(msg400).toBeDefined();
      expect(msg400!.status).toBe("error");
      expect(msg400!.content).toContain("1 attempt");
      expect(msg400!.content).toContain("HTTPError");
    });
  });

  describe("Backoff calculation", () => {
    it("should use exponential backoff", async () => {
      const tempFailingTool = createTemporaryFailureTool(3);

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              name: "temp_failing_tool",
              args: { input: "test" },
              id: "1",
            },
          ],
          [],
        ],
      });

      const retry = toolRetryMiddleware({
        maxRetries: 3,
        initialDelayMs: 50,
        backoffFactor: 2.0,
        jitter: false,
      });

      const agent = createAgent({
        model,
        tools: [tempFailingTool],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const startTime = performance.now();
      const result = await agent.invoke(
        { messages: [new HumanMessage("Use temp failing tool")] },
        { configurable: { thread_id: "test" } }
      );
      const endTime = performance.now();

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages).toHaveLength(1);
      expect(toolMessages[0].content).toContain("Success after 4 attempts");

      // Calculate expected total delay: 50 + 100 + 200 = 350ms
      const expectedDelay = 50 + 100 + 200;
      const actualDelay = endTime - startTime;

      // Allow some tolerance for execution time
      expect(actualDelay).toBeGreaterThanOrEqual(expectedDelay);
      expect(actualDelay).toBeLessThan(expectedDelay + 200); // +200ms tolerance
    });

    it("should use constant backoff when backoffFactor is 0", async () => {
      const tempFailingTool = createTemporaryFailureTool(2);

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              name: "temp_failing_tool",
              args: { input: "test" },
              id: "1",
            },
          ],
          [],
        ],
      });

      const retry = toolRetryMiddleware({
        maxRetries: 2,
        initialDelayMs: 50,
        backoffFactor: 0.0, // Constant delay
        jitter: false,
      });

      const agent = createAgent({
        model,
        tools: [tempFailingTool],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const startTime = performance.now();
      const result = await agent.invoke(
        { messages: [new HumanMessage("Use temp failing tool")] },
        { configurable: { thread_id: "test" } }
      );
      const endTime = performance.now();

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages).toHaveLength(1);
      expect(toolMessages[0].content).toContain("Success after 3 attempts");

      // Calculate expected total delay: 50 + 50 = 100ms (constant)
      const expectedDelay = 50 + 50;
      const actualDelay = endTime - startTime;

      // Verify constant backoff (should be much less than exponential)
      expect(actualDelay).toBeGreaterThanOrEqual(expectedDelay);
      expect(actualDelay).toBeLessThan(expectedDelay + 200); // +200ms tolerance
      // With exponential backoff (2.0), would be 50 + 100 = 150ms minimum
    });

    it("should cap delay at maxDelay", () => {
      // Test calculateRetryDelay directly (like Python does)
      const config = {
        backoffFactor: 10.0, // Very aggressive backoff
        initialDelayMs: 1000,
        maxDelayMs: 2000, // Cap at 2 seconds
        jitter: false,
      };

      const delay0 = calculateRetryDelay(config, 0); // 1000
      const delay1 = calculateRetryDelay(config, 1); // 10000 -> capped to 2000
      const delay2 = calculateRetryDelay(config, 2); // 100000 -> capped to 2000

      expect(delay0).toBe(1000);
      expect(delay1).toBe(2000);
      expect(delay2).toBe(2000);
    });

    it("should add jitter to delays", () => {
      // Test calculateRetryDelay directly (like Python does)
      const config = {
        backoffFactor: 1.0,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        jitter: true,
      };

      // Calculate delays multiple times to verify jitter variation
      const delays = Array.from({ length: 10 }, () =>
        calculateRetryDelay(config, 0)
      );

      // All delays should be within the jitter range (±25%)
      for (const delay of delays) {
        expect(delay).toBeGreaterThanOrEqual(75); // 100 - 25%
        expect(delay).toBeLessThanOrEqual(125); // 100 + 25%
      }

      // With jitter, delays should vary (not all the same)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe("Zero retries", () => {
    it("should not retry when maxRetries is 0", async () => {
      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              name: "failing_tool",
              args: { input: "test" },
              id: "1",
            },
          ],
          [],
        ],
      });

      const retry = toolRetryMiddleware({
        maxRetries: 0, // No retries
        initialDelayMs: 10,
        jitter: false,
        onFailure: "continue",
      });

      const agent = createAgent({
        model,
        tools: [failingTool],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Use failing tool")] },
        { configurable: { thread_id: "test" } }
      );

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages).toHaveLength(1);
      // Should fail after 1 attempt only
      expect(toolMessages[0].content).toContain("1 attempt");
      expect(toolMessages[0].status).toBe("error");
    });
  });

  describe("Middleware composition", () => {
    it("should compose correctly with other middleware", async () => {
      const callLog: string[] = [];

      // Custom logging middleware
      const loggingMiddleware = createMiddleware({
        name: "loggingMiddleware",
        wrapToolCall: async (request, handler) => {
          callLog.push(`before_${request.tool?.name}`);
          const response = await handler(request);
          callLog.push(`after_${request.tool?.name}`);
          return response;
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              name: "working_tool",
              args: { input: "test" },
              id: "1",
            },
          ],
          [],
        ],
      });

      const retry = toolRetryMiddleware({
        maxRetries: 2,
        initialDelayMs: 10,
        jitter: false,
      });

      const agent = createAgent({
        model,
        tools: [workingTool],
        middleware: [loggingMiddleware, retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Use working tool")] },
        { configurable: { thread_id: "test" } }
      );

      // Both middleware should be called
      expect(callLog).toEqual(["before_working_tool", "after_working_tool"]);

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages).toHaveLength(1);
      expect(toolMessages[0].content).toContain("Success: test");
    });
  });
});
