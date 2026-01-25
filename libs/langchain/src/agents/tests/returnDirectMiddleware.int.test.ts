import { describe, it, expect } from "vitest";
import {
  createAgent,
  summarizationMiddleware,
  createMiddleware,
} from "../../index.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";

/**
 * Integration tests for returnDirect functionality with middleware
 *
 * Tests the bug fix for ReactAgent routing when using:
 * - Tools with returnDirect: true
 * - Middleware with beforeModel hooks (e.g., summarizationMiddleware)
 *
 * Bug: Non-returnDirect tools fail with "Branch condition returned unknown"
 * when the agent has both returnDirect tools and beforeModel middleware.
 */

const MODEL = "claude-sonnet-4-5-20250929";

// Create test tools
const normalTool = tool(
  (input: { query: string }) => {
    return `Normal tool result: ${input.query}`;
  },
  {
    name: "normal_tool",
    description: "A normal tool without returnDirect",
    schema: z.object({
      query: z.string().describe("The query to process"),
    }),
  }
);

const interactionTool = tool(
  (input: { question: string; options?: string[] }) => {
    return JSON.stringify({
      type: "question",
      question: input.question,
      options: input.options || [],
    });
  },
  {
    name: "ask_question",
    description: "Ask user a question and return directly",
    schema: z.object({
      question: z.string().describe("The question to ask"),
      options: z
        .array(z.string())
        .optional()
        .describe("Optional answer choices"),
    }),
    returnDirect: true, // Key: returnDirect flag
  }
);

const calculatorTool = tool(
  (input: { expression: string }) => {
    try {
      const result = eval(input.expression);
      return `Result: ${result}`;
    } catch (error) {
      return `Error: Invalid expression`;
    }
  },
  {
    name: "calculator",
    description: "Calculate a mathematical expression",
    schema: z.object({
      expression: z.string().describe("Mathematical expression"),
    }),
  }
);

describe("returnDirect with beforeModel middleware", () => {
  it("should work with normal tools and summarizationMiddleware", async () => {
    // This test verifies the bug fix:
    // Before fix: Failed with "Branch condition returned unknown"
    // After fix: Works correctly
    const agent = createAgent({
      name: "middleware_agent",
      model: MODEL,
      tools: [normalTool, interactionTool, calculatorTool],
      systemPrompt: "You are a helpful assistant.",
      middleware: [
        summarizationMiddleware({
          model: MODEL,
          trigger: { tokens: 4000 },
          keep: { messages: 20 },
        }),
      ],
    });

    // Call a normal tool (not returnDirect)
    const result = await agent.invoke({
      messages: [new HumanMessage("Calculate 10 + 20")],
    });

    // Verify: Should complete successfully
    const lastMessage = result.messages[result.messages.length - 1];
    expect(lastMessage._getType()).toBe("ai");

    // Verify: Calculator tool was used
    const toolMessages = result.messages.filter((m) => m._getType() === "tool");
    const hasCalculatorTool = toolMessages.some((m) => m.name === "calculator");
    expect(hasCalculatorTool).toBe(true);
  }, 30000);

  it("should work with returnDirect tool and summarizationMiddleware", async () => {
    const agent = createAgent({
      name: "middleware_returndirect_agent",
      model: MODEL,
      tools: [normalTool, interactionTool, calculatorTool],
      systemPrompt: "You are a helpful assistant.",
      middleware: [
        summarizationMiddleware({
          model: MODEL,
          trigger: { tokens: 4000 },
          keep: { messages: 20 },
        }),
      ],
    });

    // Call returnDirect tool
    const result = await agent.invoke({
      messages: [
        new HumanMessage(
          "Ask me what's my favorite color, options: red, blue, green"
        ),
      ],
    });

    // Verify: Should end immediately after tool execution
    const lastMessage = result.messages[result.messages.length - 1];
    expect(lastMessage._getType()).toBe("tool");
    expect(lastMessage.name).toBe("ask_question");

    // Verify: No subsequent AI message
    const aiMessages = result.messages.filter((m) => m._getType() === "ai");
    expect(aiMessages.length).toBe(1); // Only the one that called the tool
  }, 30000);
});

describe("returnDirect without beforeModel middleware", () => {
  // Create middleware without beforeModel hooks
  const afterModelOnlyMiddleware = createMiddleware({
    name: "AfterModelOnly",
    afterModel: async (state, runtime) => {
      // No-op middleware for testing
      return undefined;
    },
  });

  it("should work with normal tools and afterModel middleware", async () => {
    const agent = createAgent({
      name: "aftermodel_agent",
      model: MODEL,
      tools: [normalTool, calculatorTool],
      systemPrompt: "You are a helpful assistant.",
      middleware: [afterModelOnlyMiddleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Calculate 50 + 50")],
    });

    // Verify: Should work normally
    const lastMessage = result.messages[result.messages.length - 1];
    expect(lastMessage._getType()).toBe("ai");
  }, 30000);

  it("should work with returnDirect tool and afterModel middleware", async () => {
    const agent = createAgent({
      name: "aftermodel_returndirect_agent",
      model: MODEL,
      tools: [normalTool, interactionTool, calculatorTool],
      systemPrompt: "You are a helpful assistant.",
      middleware: [afterModelOnlyMiddleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Ask me about my favorite movie")],
    });

    // Verify: returnDirect works with afterModel middleware
    const lastMessage = result.messages[result.messages.length - 1];
    expect(lastMessage._getType()).toBe("tool");
    expect(lastMessage.name).toBe("ask_question");
  }, 30000);
});

describe("returnDirect baseline (no middleware)", () => {
  it("should work with returnDirect tool and no middleware", async () => {
    const agent = createAgent({
      name: "baseline_agent",
      model: MODEL,
      tools: [normalTool, interactionTool, calculatorTool],
      systemPrompt: "You are a helpful assistant.",
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Ask me a question")],
    });

    // Verify: returnDirect works without middleware (baseline)
    const lastMessage = result.messages[result.messages.length - 1];
    expect(lastMessage._getType()).toBe("tool");
    expect(lastMessage.name).toBe("ask_question");
  }, 30000);

  it("should work with normal tool and no middleware", async () => {
    const agent = createAgent({
      name: "baseline_normal_agent",
      model: MODEL,
      tools: [normalTool, calculatorTool],
      systemPrompt: "You are a helpful assistant.",
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Calculate 100 + 200")],
    });

    // Verify: Normal tools work without middleware (baseline)
    const lastMessage = result.messages[result.messages.length - 1];
    expect(lastMessage._getType()).toBe("ai");
  }, 30000);
});
