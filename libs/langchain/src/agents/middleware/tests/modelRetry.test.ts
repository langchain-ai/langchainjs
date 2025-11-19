/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { StructuredTool } from "@langchain/core/tools";
import { RunnableBinding } from "@langchain/core/runnables";

import { createAgent } from "../../index.js";
import { modelRetryMiddleware } from "../modelRetry.js";
import { FakeToolCallingModel } from "../../tests/utils.js";
import { InvalidRetryConfigError } from "../error.js";

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

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Helper class to create a model that fails a certain number of times before succeeding.
 */
class TemporaryFailureModel extends FakeToolCallingModel {
  private attempt = 0;
  private failCount: number;

  _generate = vi.fn(
    async (...args: Parameters<FakeToolCallingModel["_generate"]>) => {
      this.attempt += 1;
      if (this.attempt <= this.failCount) {
        throw new Error(`Temporary failure ${this.attempt}`);
      }
      const result = await super._generate(...args);
      // Modify the content to indicate success after retries
      if (result.generations[0]?.message) {
        result.generations[0].message = new AIMessage({
          content: `Success after ${this.attempt} attempts`,
          id: result.generations[0].message.id,
        });
      }
      return result;
    }
  );

  constructor(failCount: number) {
    super({ toolCalls: [[]] });
    this.failCount = failCount;
  }

  bindTools(tools: StructuredTool[]) {
    // eslint-disable-next-line dot-notation
    this["tools"] = [...this["tools"], ...tools];
    return this as unknown as RunnableBinding<any, any, any>;
  }
}

/**
 * Helper class to create a model that always fails with a specific error.
 */
class AlwaysFailingModel extends FakeToolCallingModel {
  private error: Error;
  _generate = vi.fn(() => {
    throw this.error;
  });

  constructor(error: Error) {
    super({ toolCalls: [[]] });
    this.error = error;
  }

  bindTools(tools: StructuredTool[]) {
    // eslint-disable-next-line dot-notation
    this["tools"] = [...this["tools"], ...tools];
    return this as unknown as RunnableBinding<any, any, any>;
  }
}

describe("modelRetryMiddleware", () => {
  describe("Initialization", () => {
    it("should initialize with default values", () => {
      const retry = modelRetryMiddleware();
      expect(retry).toBeDefined();
      expect(retry.name).toBe("modelRetryMiddleware");
    });

    it("should initialize with custom values", () => {
      const retry = modelRetryMiddleware({
        maxRetries: 5,
        retryOn: [TimeoutError, NetworkError],
        onFailure: "error",
        backoffFactor: 1.5,
        initialDelayMs: 500,
        maxDelayMs: 30000,
        jitter: false,
      });
      expect(retry).toBeDefined();
      expect(retry.name).toBe("modelRetryMiddleware");
    });
  });

  describe("Validation", () => {
    it("should throw ZodError for invalid maxRetries", () => {
      try {
        modelRetryMiddleware({ maxRetries: -1 });
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

    it("should throw ZodError for invalid initialDelayMs", () => {
      try {
        modelRetryMiddleware({ initialDelayMs: -1 });
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

    it("should throw ZodError for invalid maxDelayMs", () => {
      try {
        modelRetryMiddleware({ maxDelayMs: -1 });
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

    it("should throw ZodError for invalid backoffFactor", () => {
      try {
        modelRetryMiddleware({ backoffFactor: -1 });
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
  });

  describe("Basic functionality", () => {
    it("should not retry working model (no retry needed)", async () => {
      const model = new FakeToolCallingModel({
        toolCalls: [[]],
      });

      const retry = modelRetryMiddleware({
        maxRetries: 2,
        initialDelayMs: 10,
        jitter: false,
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Hello")] },
        { configurable: { thread_id: "test" } }
      );

      const aiMessages = result.messages.filter(AIMessage.isInstance);
      expect(aiMessages.length).toBeGreaterThan(0);
    });

    it("should retry failing model and succeed after temporary failures", async () => {
      const model = new TemporaryFailureModel(2);

      const retry = modelRetryMiddleware({
        maxRetries: 3,
        initialDelayMs: 10,
        jitter: false,
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Hello")] },
        { configurable: { thread_id: "test" } }
      );

      const aiMessages = result.messages.filter(AIMessage.isInstance);
      expect(aiMessages.length).toBeGreaterThan(0);
      expect(aiMessages[aiMessages.length - 1].content).toContain(
        "Success after 3 attempts"
      );
      expect(model._generate).toHaveBeenCalledTimes(3);
    });

    it("should retry failing model and raise on failure (default)", async () => {
      const model = new AlwaysFailingModel(new Error("Model failed"));

      const retry = modelRetryMiddleware({
        maxRetries: 2,
        initialDelayMs: 10,
        jitter: false,
        onFailure: "error",
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      // Should raise the Error from the model
      await expect(
        agent.invoke(
          { messages: [new HumanMessage("Hello")] },
          { configurable: { thread_id: "test" } }
        )
      ).rejects.toThrow("Model failed");
    });

    it("should retry failing model and return error message", async () => {
      const model = new AlwaysFailingModel(new Error("Model failed"));

      const retry = modelRetryMiddleware({
        maxRetries: 2,
        initialDelayMs: 10,
        jitter: false,
        onFailure: "continue",
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Hello")] },
        { configurable: { thread_id: "test" } }
      );

      const aiMessages = result.messages.filter(AIMessage.isInstance);
      expect(aiMessages.length).toBeGreaterThan(0);
      // Should contain error message with attempts
      expect(aiMessages[aiMessages.length - 1].content).toContain("3 attempts");
      expect(aiMessages[aiMessages.length - 1].content).toContain("Error");
    });

    it("should use custom failure formatter", async () => {
      const customFormatter = (error: Error): string => {
        return `Custom error: ${error.constructor.name}`;
      };

      const model = new AlwaysFailingModel(new Error("Model failed"));

      const retry = modelRetryMiddleware({
        maxRetries: 1,
        initialDelayMs: 10,
        jitter: false,
        onFailure: customFormatter,
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Hello")] },
        { configurable: { thread_id: "test" } }
      );

      const aiMessages = result.messages.filter(AIMessage.isInstance);
      expect(aiMessages.length).toBeGreaterThan(0);
      expect(aiMessages[aiMessages.length - 1].content).toBe(
        "Custom error: Error"
      );
    });
  });

  describe("Retry on specific exceptions", () => {
    it("should retry on specified error types", async () => {
      class TimeoutFailureModel extends FakeToolCallingModel {
        private attempt = 0;

        _generate = vi.fn(
          async (...args: Parameters<FakeToolCallingModel["_generate"]>) => {
            this.attempt += 1;
            if (this.attempt <= 1) {
              throw new TimeoutError("Timeout");
            }
            return super._generate(...args);
          }
        );

        bindTools(tools: StructuredTool[]) {
          // eslint-disable-next-line dot-notation
          this["tools"] = [...this["tools"], ...tools];
          return this as unknown as RunnableBinding<any, any, any>;
        }
      }

      const model = new TimeoutFailureModel();

      const retry = modelRetryMiddleware({
        maxRetries: 2,
        initialDelayMs: 10,
        jitter: false,
        retryOn: [TimeoutError],
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Hello")] },
        { configurable: { thread_id: "test" } }
      );

      const aiMessages = result.messages.filter(AIMessage.isInstance);
      expect(aiMessages.length).toBeGreaterThan(0);
      expect(model._generate).toHaveBeenCalledTimes(2);
    });

    it("should not retry on non-specified error types", async () => {
      const model = new AlwaysFailingModel(new Error("Generic error"));

      const retry = modelRetryMiddleware({
        maxRetries: 2,
        initialDelayMs: 10,
        jitter: false,
        retryOn: [TimeoutError, RateLimitError],
        onFailure: "continue",
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Hello")] },
        { configurable: { thread_id: "test" } }
      );

      const aiMessages = result.messages.filter(AIMessage.isInstance);
      expect(aiMessages.length).toBeGreaterThan(0);
      // Should fail immediately without retries since Error is not in retryOn list
      expect(aiMessages[aiMessages.length - 1].content).toContain("1 attempt");
    });

    it("should use custom retry function", async () => {
      class RateLimitFailureModel extends FakeToolCallingModel {
        private attempt = 0;

        constructor() {
          super({ toolCalls: [[]] });
        }

        _generate = vi.fn(
          async (...args: Parameters<FakeToolCallingModel["_generate"]>) => {
            this.attempt += 1;
            if (this.attempt <= 1) {
              const error = new Error("Rate limit exceeded");
              (error as any).statusCode = 429;
              throw error;
            }
            return super._generate(...args);
          }
        );

        bindTools(tools: StructuredTool[]) {
          // eslint-disable-next-line dot-notation
          this["tools"] = [...this["tools"], ...tools];
          return this as unknown as RunnableBinding<any, any, any>;
        }
      }

      const model = new RateLimitFailureModel();

      const shouldRetry = vi.fn((error: Error): boolean => {
        return (
          error.name === "RateLimitError" || (error as any).statusCode === 429
        );
      });

      const retry = modelRetryMiddleware({
        maxRetries: 2,
        initialDelayMs: 10,
        jitter: false,
        retryOn: shouldRetry,
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Hello")] },
        { configurable: { thread_id: "test" } }
      );

      const aiMessages = result.messages.filter(AIMessage.isInstance);
      expect(aiMessages.length).toBeGreaterThan(0);
      expect(shouldRetry).toHaveBeenCalledTimes(1);
      expect(model._generate).toHaveBeenCalledTimes(2);
    });
  });

  describe("Backoff behavior", () => {
    it("should apply exponential backoff", async () => {
      class BackoffTestModel extends FakeToolCallingModel {
        private attempt = 0;
        private delays: number[] = [];
        private lastTime = Date.now();

        constructor() {
          super({ toolCalls: [[]] });
        }

        _generate = vi.fn(
          async (...args: Parameters<FakeToolCallingModel["_generate"]>) => {
            const currentTime = Date.now();
            if (this.attempt > 0) {
              this.delays.push(currentTime - this.lastTime);
            }
            this.lastTime = currentTime;
            this.attempt += 1;
            if (this.attempt <= 2) {
              throw new Error(`Temporary failure ${this.attempt}`);
            }
            return super._generate(...args);
          }
        );

        bindTools(tools: StructuredTool[]) {
          // eslint-disable-next-line dot-notation
          this["tools"] = [...this["tools"], ...tools];
          return this as unknown as RunnableBinding<any, any, any>;
        }

        getDelays() {
          return this.delays;
        }
      }

      const model = new BackoffTestModel();

      const retry = modelRetryMiddleware({
        maxRetries: 3,
        initialDelayMs: 100,
        backoffFactor: 2.0,
        jitter: false,
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      await agent.invoke(
        { messages: [new HumanMessage("Hello")] },
        { configurable: { thread_id: "test" } }
      );

      const delays = model.getDelays();
      // Should have delays between retries
      expect(delays.length).toBeGreaterThan(0);
      // First delay should be around initialDelayMs (100ms)
      expect(delays[0]).toBeGreaterThanOrEqual(90);
      expect(delays[0]).toBeLessThan(150);
      expect(delays[1]).toBeGreaterThanOrEqual(180);
      expect(delays[1]).toBeLessThan(250);
      expect(model._generate).toHaveBeenCalledTimes(3);
    });

    it("should apply constant backoff when backoffFactor is 0", async () => {
      class ConstantBackoffTestModel extends FakeToolCallingModel {
        private attempt = 0;
        private delays: number[] = [];
        private lastTime = Date.now();

        constructor() {
          super({ toolCalls: [[]] });
        }

        _generate = vi.fn(
          async (...args: Parameters<FakeToolCallingModel["_generate"]>) => {
            const currentTime = Date.now();
            if (this.attempt > 0) {
              this.delays.push(currentTime - this.lastTime);
            }
            this.lastTime = currentTime;
            this.attempt += 1;
            if (this.attempt <= 2) {
              throw new Error(`Temporary failure ${this.attempt}`);
            }
            return super._generate(...args);
          }
        );

        bindTools(tools: StructuredTool[]) {
          // eslint-disable-next-line dot-notation
          this["tools"] = [...this["tools"], ...tools];
          return this as unknown as RunnableBinding<any, any, any>;
        }

        getDelays() {
          return this.delays;
        }
      }

      const model = new ConstantBackoffTestModel();

      const retry = modelRetryMiddleware({
        maxRetries: 3,
        initialDelayMs: 100,
        backoffFactor: 0.0,
        jitter: false,
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [retry] as const,
        checkpointer: new MemorySaver(),
      });

      await agent.invoke(
        { messages: [new HumanMessage("Hello")] },
        { configurable: { thread_id: "test" } }
      );

      const delays = model.getDelays();
      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
      expect(avgDelay).toBeGreaterThanOrEqual(90);
      expect(avgDelay).toBeLessThan(150);
      expect(model._generate).toHaveBeenCalledTimes(3);
    });
  });
});
