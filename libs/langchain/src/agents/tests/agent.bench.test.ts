import { z } from "zod/v3";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Bench, type TaskResultCompleted } from "tinybench";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";

import { FakeToolCallingChatModel } from "./utils.js";
import { createAgent, createMiddleware } from "../index.js";

const bench = new Bench({ concurrency: "bench", threshold: 2 });

type Benchmark = {
  warmup?: () => Promise<void>;
  fn: () => Promise<void>;
  assert: (result: TaskResultCompleted) => void;
};

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

const tools10 = createTools(10);
const tools50 = createTools(50);
const messages50 = createLargeMessageHistory(50);
const messages100 = createLargeMessageHistory(100);

const simpleToolCallingModel = new FakeToolCallingChatModel({
  responses: [new AIMessage({ content: "Hello, world!" })],
});
const simpleTool = tool(async () => "Hello, world!", {
  name: "test",
  description: "Test tool",
  schema: z.object({
    name: z.string(),
  }),
});
const simpleToolCallingAgent = createAgent({
  model: simpleToolCallingModel,
  tools: [simpleTool],
});

const modelDone = new FakeToolCallingChatModel({
  responses: [new AIMessage({ content: "Done" })],
});

const agentWith10Tools = createAgent({
  model: modelDone,
  tools: tools10,
});

const agentWith50Tools = createAgent({
  model: modelDone,
  tools: tools50,
});

const agentWithLargeHistory = createAgent({
  model: new FakeToolCallingChatModel({
    responses: [new AIMessage({ content: "Response" })],
  }),
  tools: [],
});

const singleMiddleware = createMiddleware({
  name: "TestMiddleware",
  beforeModel: async (state) => state,
});
const agentWithSingleMiddleware = createAgent({
  model: modelDone,
  tools: [],
  middleware: [singleMiddleware],
});

const middleware5 = Array.from({ length: 5 }, (_, i) =>
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
    afterModel: async (state) => state,
  })
);
const agentWith5Middleware = createAgent({
  model: modelDone,
  tools: [],
  middleware: middleware5,
});

const middleware10 = Array.from({ length: 10 }, (_, i) =>
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
const agentWith10Middleware = createAgent({
  model: modelDone,
  tools: [],
  middleware: middleware10,
});

const wrapModelCallMiddleware = createMiddleware({
  name: "WrapModelCallMiddleware",
  wrapModelCall: async (request, handler) => handler(request),
});
const agentWithWrapModelCall = createAgent({
  model: modelDone,
  tools: [],
  middleware: [wrapModelCallMiddleware],
});

const wrapToolCallModel = new FakeToolCallingChatModel({
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
const wrapToolCallMiddleware = createMiddleware({
  name: "WrapToolCallMiddleware",
  wrapToolCall: async (request, handler) => handler(request),
});
const agentWithWrapToolCall = createAgent({
  model: wrapToolCallModel,
  tools: [testTool],
  middleware: [wrapToolCallMiddleware],
});

const responseFormatModel = new FakeToolCallingChatModel({
  responses: [new AIMessage({ content: "Done" })],
  structuredResponse: { name: "John", age: 30 },
});
const responseSchema = z.object({
  name: z.string(),
  age: z.number(),
});
const agentWithResponseFormat = createAgent({
  model: responseFormatModel,
  tools: [],
  responseFormat: responseSchema,
});

const metadataTimestamp = Date.now();
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
const agentWithComplexStateSchema = createAgent({
  model: modelDone,
  tools: [],
  stateSchema,
});

const middleware5Simple = Array.from({ length: 5 }, (_, i) =>
  createMiddleware({
    name: `Middleware${i}`,
    beforeModel: async (state) => state,
    afterModel: async (state) => state,
  })
);
const agentWith10ToolsAnd5Middleware = createAgent({
  model: modelDone,
  tools: tools10,
  middleware: middleware5Simple,
});

const middleware10Value = Array.from({ length: 10 }, (_, i) =>
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
const agentWith50ToolsAnd10Middleware = createAgent({
  model: modelDone,
  tools: tools50,
  middleware: middleware10Value,
});

const middleware3 = Array.from({ length: 3 }, (_, i) =>
  createMiddleware({
    name: `Middleware${i}`,
    beforeModel: async (state) => state,
  })
);
const agentWithLargeHistoryAndMiddleware = createAgent({
  model: modelDone,
  tools: [],
  middleware: middleware3,
});

const middlewareToolsModel = new FakeToolCallingChatModel({
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
const middlewareWithTools = createMiddleware({
  name: "MiddlewareWithTools",
  tools: [middlewareTool],
});
const agentWithMiddlewareTools = createAgent({
  model: middlewareToolsModel,
  tools: [],
  middleware: [middlewareWithTools],
});

const benchmarks: Record<string, Benchmark> = {
  "simple tool calling agent": {
    fn: async () => {
      await simpleToolCallingAgent.invoke({
        messages: [new HumanMessage("Hello, world!")],
      });
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  },

  "agent with 10 tools": {
    fn: async () => {
      await agentWith10Tools.invoke({
        messages: [new HumanMessage("Use tool_0")],
      });
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  },

  "agent with 50 tools": {
    fn: async () => {
      await agentWith50Tools.invoke({
        messages: [new HumanMessage("Use tool_0")],
      });
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  },

  "agent with large message history (100 messages)": {
    fn: async () => {
      await agentWithLargeHistory.invoke({
        messages: messages100,
      });
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  },

  "agent with single middleware (beforeModel hook)": {
    fn: async () => {
      await agentWithSingleMiddleware.invoke({
        messages: [new HumanMessage("Hello")],
      });
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  },

  "agent with 5 middleware instances": {
    fn: async () => {
      await agentWith5Middleware.invoke({
        messages: [new HumanMessage("Hello")],
      });
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(65);
    },
  },

  "agent with 10 middleware instances": {
    fn: async () => {
      await agentWith10Middleware.invoke(
        {
          messages: [new HumanMessage("Hello")],
        },
        {
          recursionLimit: 100,
        }
      );
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(80);
    },
  },

  "agent with wrapModelCall middleware": {
    fn: async () => {
      await agentWithWrapModelCall.invoke({
        messages: [new HumanMessage("Hello")],
      });
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(80);
    },
  },

  "agent with wrapToolCall middleware": {
    warmup: async () => {
      wrapToolCallModel.reset();
      await agentWithWrapToolCall.invoke({
        messages: [new HumanMessage("Use test_tool")],
      });
    },
    fn: async () => {
      wrapToolCallModel.reset();
      await agentWithWrapToolCall.invoke({
        messages: [new HumanMessage("Use test_tool")],
      });
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(120);
    },
  },

  "agent with responseFormat": {
    warmup: async () => {
      responseFormatModel.reset();
      await agentWithResponseFormat.invoke({
        messages: [new HumanMessage("Extract: John, 30")],
      });
    },
    fn: async () => {
      responseFormatModel.reset();
      await agentWithResponseFormat.invoke({
        messages: [new HumanMessage("Extract: John, 30")],
      });
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  },

  "agent with complex state schema": {
    fn: async () => {
      await agentWithComplexStateSchema.invoke({
        messages: [new HumanMessage("Hello")],
        counter: 0,
        history: [],
        metadata: {
          userId: "user123",
          sessionId: "session456",
          timestamp: metadataTimestamp,
        },
      });
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  },

  "agent with 10 tools and 5 middleware": {
    fn: async () => {
      await agentWith10ToolsAnd5Middleware.invoke({
        messages: [new HumanMessage("Use tool_0")],
      });
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(80);
    },
  },

  "agent with 50 tools and 10 middleware": {
    fn: async () => {
      await agentWith50ToolsAnd10Middleware.invoke(
        {
          messages: [new HumanMessage("Use tool_0")],
        },
        {
          recursionLimit: 100,
        }
      );
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(80);
    },
  },

  "agent with large message history and middleware": {
    fn: async () => {
      await agentWithLargeHistoryAndMiddleware.invoke({
        messages: messages50,
      });
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(60);
    },
  },

  "agent with middleware tools": {
    warmup: async () => {
      middlewareToolsModel.reset();
      await agentWithMiddlewareTools.invoke({
        messages: [new HumanMessage("Use middleware_tool")],
      });
    },
    fn: async () => {
      middlewareToolsModel.reset();
      await agentWithMiddlewareTools.invoke({
        messages: [new HumanMessage("Use middleware_tool")],
      });
    },
    assert: (result) => {
      expect(result.latency.mean).toBeLessThanOrEqual(120);
    },
  },
};

describe("createAgent benchmarks", () => {
  for (const [name, { fn }] of Object.entries(benchmarks)) {
    bench.add(name, fn);
  }

  beforeAll(async () => {
    for (const { warmup, fn } of Object.values(benchmarks)) {
      if (warmup) {
        await warmup();
      } else {
        await fn();
      }
    }
  }, 60 * 1000);

  beforeAll(bench.run.bind(bench), 60 * 1000);

  for (const [name, { assert }] of Object.entries(benchmarks)) {
    it(name, () => {
      const result = bench.tasks.find((t) => t.name === name)!.result;
      if (!result || result.state !== "completed")
        throw new Error(`Result for ${name} is not completed`);
      assert(result);
    });
  }

  afterAll(() => {
    console.log(`\n${"=".repeat(100)}`);
    console.log("📊 Benchmark Results Summary");
    console.log(`${"=".repeat(100)}\n`);

    // Sort tasks by mean latency
    const sortedTasks = [...bench.tasks]
      .filter((task) => task.result?.state === "completed")
      .sort((a, b) => {
        const aResult = a.result as unknown as TaskResultCompleted;
        const bResult = b.result as unknown as TaskResultCompleted;
        return aResult.latency.mean - bResult.latency.mean;
      });

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
      const result = task.result as unknown as TaskResultCompleted;
      const latency = result.latency;
      const mean = latency.mean.toFixed(2);
      const min = latency.min.toFixed(2);
      const max = latency.max.toFixed(2);
      const sd = latency.sd.toFixed(2);
      const p99 = latency.p99?.toFixed(2) ?? "N/A";
      const samples = latency.samplesCount.toString();

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
      const result = task.result as unknown as TaskResultCompleted;
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
      console.log(`  Samples:  ${latency.samplesCount}`);
    }

    console.log(`\n${"=".repeat(100)}\n`);
  });
});
