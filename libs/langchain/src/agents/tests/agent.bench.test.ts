import { z } from "zod/v3";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Bench, type TaskResult } from "tinybench";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";

import { FakeToolCallingChatModel } from "./utils.js";
import { createAgent, createMiddleware } from "../index.js";

const bench = new Bench();
bench.concurrency = "bench";
bench.threshold = 2;

type Benchmarks = Record<
  string,
  [() => Promise<void>, (result: TaskResult) => void]
>;

// Helper function to create multiple tools
function createTools(count: number) {
  return Array.from({ length: count }, (_, i) =>
    tool(async (input: { value: string }) => `Result ${i}: ${input.value}`, {
      name: `tool_${i}`,
      description: `Tool number ${i} for testing`,
      schema: z.object({
        value: z.string().describe(`Value to process with tool ${i}`),
      }),
    })
  );
}

// Helper function to create large message history
function createLargeMessageHistory(count: number) {
  return Array.from({ length: count }, (_, i) =>
    i % 2 === 0
      ? new HumanMessage(`User message ${i}`)
      : new AIMessage(`AI response ${i}`)
  );
}

const benchmarks: Benchmarks = {
  "simple tool calling agent": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Hello, world!" })],
      });

      const t = tool(async () => "Hello, world!", {
        name: "test",
        description: "Test tool",
        schema: z.object({
          name: z.string(),
        }),
      });

      const agent = createAgent({
        model,
        tools: [t],
      });

      await agent.invoke({
        messages: [new HumanMessage("Hello, world!")],
      });
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  ],

  "agent with 10 tools": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Done" })],
      });

      const tools = createTools(10);

      const agent = createAgent({
        model,
        tools,
      });

      await agent.invoke({
        messages: [new HumanMessage("Use tool_0")],
      });
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  ],

  "agent with 50 tools": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Done" })],
      });

      const tools = createTools(50);

      const agent = createAgent({
        model,
        tools,
      });

      await agent.invoke({
        messages: [new HumanMessage("Use tool_0")],
      });
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  ],

  "agent with large message history (100 messages)": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Response" })],
      });

      const agent = createAgent({
        model,
        tools: [],
      });

      const messages = createLargeMessageHistory(100);

      await agent.invoke({
        messages,
      });
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  ],

  "agent with single middleware (beforeModel hook)": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Done" })],
      });

      const middleware = createMiddleware({
        name: "TestMiddleware",
        beforeModel: async (state) => {
          // Simple state modification
          return state;
        },
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Hello")],
      });
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  ],

  "agent with 5 middleware instances": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Done" })],
      });

      const middleware = Array.from({ length: 5 }, (_, i) =>
        createMiddleware({
          name: `Middleware${i}`,
          stateSchema: z.object({
            [`count${i}`]: z.number().default(0),
          }),
          beforeModel: async (state) => {
            return {
              [`count${i}`]: (state[`count${i}`] ?? 0) + 1,
            };
          },
          afterModel: async (state) => {
            return state;
          },
        })
      );

      const agent = createAgent({
        model,
        tools: [],
        middleware,
      });

      await agent.invoke({
        messages: [new HumanMessage("Hello")],
      });
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(65);
    },
  ],

  "agent with 10 middleware instances": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Done" })],
      });

      const middleware = Array.from({ length: 10 }, (_, i) =>
        createMiddleware({
          name: `Middleware${i}`,
          stateSchema: z.object({
            [`count${i}`]: z.number().default(0),
          }),
          beforeAgent: async (state) => {
            return {
              [`count${i}`]: (state[`count${i}`] ?? 0) + 1,
            };
          },
          beforeModel: async (state) => {
            return {
              [`count${i}`]: (state[`count${i}`] ?? 0) + 1,
            };
          },
          afterModel: async (state) => {
            return {
              [`count${i}`]: (state[`count${i}`] ?? 0) + 1,
            };
          },
          afterAgent: async (state) => {
            return {
              [`count${i}`]: (state[`count${i}`] ?? 0) + 1,
            };
          },
        })
      );

      const agent = createAgent({
        model,
        tools: [],
        middleware,
      });

      await agent.invoke(
        {
          messages: [new HumanMessage("Hello")],
        },
        {
          recursionLimit: 100,
        }
      );
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(70);
    },
  ],

  "agent with wrapModelCall middleware": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Done" })],
      });

      const middleware = createMiddleware({
        name: "WrapModelCallMiddleware",
        wrapModelCall: async (request, handler) => {
          // Pass through with minimal overhead
          return handler(request);
        },
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Hello")],
      });
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(70);
    },
  ],

  "agent with wrapToolCall middleware": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              {
                name: "test_tool",
                args: { value: "test" },
                id: "call_1",
                type: "tool_call" as const,
              },
            ],
          }),
          new AIMessage({ content: "Done" }),
        ],
      });

      const testTool = tool(async () => "result", {
        name: "test_tool",
        description: "Test tool",
        schema: z.object({
          value: z.string(),
        }),
      });

      const middleware = createMiddleware({
        name: "WrapToolCallMiddleware",
        wrapToolCall: async (request, handler) => {
          // Pass through with minimal overhead
          return handler(request);
        },
      });

      const agent = createAgent({
        model,
        tools: [testTool],
        middleware: [middleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Use test_tool")],
      });
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(120);
    },
  ],

  "agent with responseFormat": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Done" })],
        structuredResponse: { name: "John", age: 30 },
      });

      const responseSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const agent = createAgent({
        model,
        tools: [],
        responseFormat: responseSchema,
      });

      await agent.invoke({
        messages: [new HumanMessage("Extract: John, 30")],
      });
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  ],

  "agent with complex state schema": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Done" })],
      });

      const stateSchema = z.object({
        counter: z.number().default(0),
        history: z.array(z.string()).default([]),
        metadata: z
          .object({
            userId: z.string(),
            sessionId: z.string(),
            timestamp: z.number(),
          })
          .optional(),
      });

      const agent = createAgent({
        model,
        tools: [],
        stateSchema,
      });

      await agent.invoke({
        messages: [new HumanMessage("Hello")],
        counter: 0,
        history: [],
        metadata: {
          userId: "user123",
          sessionId: "session456",
          timestamp: Date.now(),
        },
      });
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  ],

  "agent with 10 tools and 5 middleware": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Done" })],
      });

      const tools = createTools(10);

      const middleware = Array.from({ length: 5 }, (_, i) =>
        createMiddleware({
          name: `Middleware${i}`,
          beforeModel: async (state) => state,
          afterModel: async (state) => state,
        })
      );

      const agent = createAgent({
        model,
        tools,
        middleware,
      });

      await agent.invoke({
        messages: [new HumanMessage("Use tool_0")],
      });
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(70);
    },
  ],

  "agent with 50 tools and 10 middleware": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Done" })],
      });

      const tools = createTools(50);

      const middleware = Array.from({ length: 10 }, (_, i) =>
        createMiddleware({
          name: `Middleware${i}`,
          stateSchema: z.object({
            [`value${i}`]: z.string().default(""),
          }),
          beforeAgent: async (state) => state,
          beforeModel: async (state) => state,
          afterModel: async (state) => state,
          afterAgent: async (state) => state,
        })
      );

      const agent = createAgent({
        model,
        tools,
        middleware,
      });

      await agent.invoke(
        {
          messages: [new HumanMessage("Use tool_0")],
        },
        {
          recursionLimit: 100,
        }
      );
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(70);
    },
  ],

  "agent with large message history and middleware": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Done" })],
      });

      const middleware = Array.from({ length: 3 }, (_, i) =>
        createMiddleware({
          name: `Middleware${i}`,
          beforeModel: async (state) => state,
        })
      );

      const agent = createAgent({
        model,
        tools: [],
        middleware,
      });

      const messages = createLargeMessageHistory(50);

      await agent.invoke({
        messages,
      });
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  ],

  "agent with middleware tools": [
    async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              {
                name: "middleware_tool",
                args: { input: "test" },
                id: "call_1",
                type: "tool_call" as const,
              },
            ],
          }),
          new AIMessage({ content: "Done" }),
        ],
      });

      const middlewareTool = tool(async () => "result", {
        name: "middleware_tool",
        description: "Tool from middleware",
        schema: z.object({
          input: z.string(),
        }),
      });

      const middleware = createMiddleware({
        name: "MiddlewareWithTools",
        tools: [middlewareTool],
      });

      const agent = createAgent({
        model,
        tools: [],
        middleware: [middleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Use middleware_tool")],
      });
    },
    (result: TaskResult) => {
      expect(result.latency.mean).toBeLessThanOrEqual(120);
    },
  ],
};

describe("createAgent benchmarks", () => {
  for (const [name, [fn]] of Object.entries(benchmarks)) {
    bench.add(name, fn);
  }

  beforeAll(bench.run.bind(bench), 60 * 1000);

  for (const [name, [, resultFn]] of Object.entries(benchmarks)) {
    it(name, () => {
      const result = bench.tasks.find((t) => t.name === name)!.result;
      if (!result) throw new Error(`Result for ${name} is undefined`);
      resultFn(result);
    });
  }

  afterAll(() => {
    console.log(`\n${"=".repeat(100)}`);
    console.log("📊 Benchmark Results Summary");
    console.log(`${"=".repeat(100)}\n`);

    // Sort tasks by mean latency
    const sortedTasks = [...bench.tasks]
      .filter((task) => task.result)
      .sort(
        (a, b) => (a.result!.latency.mean || 0) - (b.result!.latency.mean || 0)
      );

    // Calculate column widths
    const nameWidth = Math.max(
      ...sortedTasks.map((task) => task.name.length),
      "Benchmark Name".length
    );
    const valueWidth = 12;

    // Print header
    console.log(
      `${"Benchmark Name".padEnd(nameWidth)} │ ${"Mean (ms)".padStart(
        valueWidth
      )} │ ${"Min (ms)".padStart(valueWidth)} │ ${"Max (ms)".padStart(
        valueWidth
      )} │ ${"SD (ms)".padStart(valueWidth)} │ ${"p99 (ms)".padStart(
        valueWidth
      )} │ ${"Samples".padStart(8)}`
    );
    console.log(
      `${"-".repeat(nameWidth)}─┼─${"-".repeat(valueWidth)}─┼─${"-".repeat(
        valueWidth
      )}─┼─${"-".repeat(valueWidth)}─┼─${"-".repeat(valueWidth)}─┼─${"-".repeat(
        valueWidth
      )}─┼─${"-".repeat(8)}`
    );

    // Print results
    for (const task of sortedTasks) {
      const result = task.result!;
      const latency = result.latency;
      const mean = latency.mean.toFixed(2);
      const min = latency.min.toFixed(2);
      const max = latency.max.toFixed(2);
      const sd = latency.sd.toFixed(2);
      const p99 = latency.p99?.toFixed(2) ?? "N/A";
      const samples = latency.samples.length.toString();

      console.log(
        `${task.name.padEnd(nameWidth)} │ ${mean.padStart(
          valueWidth
        )} │ ${min.padStart(valueWidth)} │ ${max.padStart(
          valueWidth
        )} │ ${sd.padStart(valueWidth)} │ ${p99.padStart(
          valueWidth
        )} │ ${samples.padStart(8)}`
      );
    }

    console.log(`\n${"-".repeat(100)}`);
    console.log("📈 Detailed Statistics\n");

    for (const task of sortedTasks) {
      const result = task.result!;
      const latency = result.latency;

      console.log(`\n${task.name}:`);
      console.log(`  Mean:     ${latency.mean.toFixed(4)} ms`);
      console.log(`  Median:   ${latency.p50?.toFixed(4) ?? "N/A"} ms`);
      console.log(`  Min:      ${latency.min.toFixed(4)} ms`);
      console.log(`  Max:      ${latency.max.toFixed(4)} ms`);
      console.log(`  SD:       ${latency.sd.toFixed(4)} ms`);
      console.log(`  p75:      ${latency.p75?.toFixed(4) ?? "N/A"} ms`);
      console.log(`  p99:      ${latency.p99?.toFixed(4) ?? "N/A"} ms`);
      console.log(`  p999:     ${latency.p999?.toFixed(4) ?? "N/A"} ms`);
      console.log(
        `  MOE:      ${latency.moe.toFixed(4)} ms (±${latency.rme.toFixed(2)}%)`
      );
      console.log(`  Samples:  ${latency.samples.length}`);
      if (result.error) {
        console.log(`  ⚠️  Error: ${result.error.message}`);
      }
    }

    console.log(`\n${"=".repeat(100)}\n`);
  });
});
