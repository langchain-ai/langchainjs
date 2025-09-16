/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { describe, it, expect } from "vitest";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { Command } from "@langchain/langgraph";

import { tool } from "@langchain/core/tools";
import { createAgent } from "../../index.js";
import { humanInTheLoopMiddleware } from "../hitl.js";

const calculator = tool(
  ({ a, b, operation }: { a: number; b: number; operation: string }) => {
    switch (operation) {
      case "add":
        return `${a} + ${b} = ${a + b}`;
      case "multiply":
        return `${a} * ${b} = ${a * b}`;
      default:
        return "Unknown operation";
    }
  },
  {
    name: "calculator",
    description: "Perform basic math operations",
    schema: z.object({
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
      operation: z.enum(["add", "multiply"]).describe("Math operation"),
    }),
  }
);

const nameGenerator = tool(
  () => {
    return `Thomas`;
  },
  {
    name: "name_generator",
    description: "Generates a random name",
    schema: z.object({}),
  }
);

const llm = new ChatOpenAI({ model: "gpt-4o" });
const thread = {
  configurable: {
    thread_id: "test-123",
  },
};

describe("humanInTheLoopMiddleware", () => {
  describe("with structured output", () => {
    it("should accept tool calls", async () => {
      const checkpointer = new MemorySaver();
      const agent = createAgent({
        llm,
        middleware: [
          humanInTheLoopMiddleware({
            toolConfigs: {
              calculator: {
                requireApproval: true,
              },
            },
          }),
        ] as const,
        tools: [calculator],
        responseFormat: z.object({
          result: z.number().describe("The result of the calculation"),
        }),
        checkpointer,
      });

      const result = await agent.invoke(
        {
          messages: [new HumanMessage("Calculate 42 * 17")],
        },
        thread
      );

      expect(result.messages).toHaveLength(2);
      expect(HumanMessage.isInstance(result.messages[0])).toBe(true);
      expect(AIMessage.isInstance(result.messages[1])).toBe(true);
      expect(result).toHaveProperty("__interrupt__");
      expect(result.__interrupt__).toHaveLength(1);
      expect(result.__interrupt__?.[0]).toHaveProperty("value");
      expect(result.__interrupt__?.[0].value).toHaveLength(1);

      const interruptRequests = result.__interrupt__?.[0].value as any;
      expect(interruptRequests[0]).toHaveProperty("action");
      expect(interruptRequests[0].action).toBe("calculator");
      expect(interruptRequests[0]).toHaveProperty("args");

      expect(result).not.toHaveProperty("structuredResponse");

      const resume = await agent.invoke(
        new Command({
          resume: [{ id: interruptRequests[0].toolCallId, type: "accept" }],
        }),
        thread
      );
      expect(resume).toHaveProperty("structuredResponse");
      expect(resume.structuredResponse).toEqual({ result: 714 });
    });

    /**
     * This test is skipped because we see the model re-running tool calls
     * due to the fact that the tool args update changes context.
     */
    it.skip("should edit tool calls", async () => {
      const checkpointer = new MemorySaver();
      const agent = createAgent({
        llm,
        middleware: [
          humanInTheLoopMiddleware({
            toolConfigs: {
              calculator: {
                requireApproval: true,
              },
            },
          }),
        ] as const,
        tools: [calculator],
        responseFormat: z.object({
          result: z.number().describe("The result of the calculation"),
        }),
        checkpointer,
      });

      const result = await agent.invoke(
        {
          messages: [new HumanMessage("Calculate 42 * 17")],
        },
        thread
      );

      expect(result.messages).toHaveLength(2);
      expect(HumanMessage.isInstance(result.messages[0])).toBe(true);
      expect(AIMessage.isInstance(result.messages[1])).toBe(true);
      expect(result).toHaveProperty("__interrupt__");
      expect(result.__interrupt__).toHaveLength(1);
      expect(result.__interrupt__?.[0]).toHaveProperty("value");
      expect(result.__interrupt__?.[0].value).toHaveLength(1);

      const interruptRequests = result.__interrupt__?.[0].value as any;
      expect(interruptRequests[0]).toHaveProperty("action");
      expect(interruptRequests[0].action).toBe("calculator");
      expect(interruptRequests[0]).toHaveProperty("args");

      expect(result).not.toHaveProperty("structuredResponse");

      const resume = await agent.invoke(
        new Command({
          resume: [
            {
              id: interruptRequests[0].toolCallId,
              type: "edit",
              args: { ...interruptRequests[0].args, operation: "add" },
            },
          ],
        }),
        thread
      );
      expect(resume).toHaveProperty("structuredResponse");
      expect(resume.structuredResponse).toEqual({
        result: expect.toBeOneOf([59, 714]),
      });
    });

    it("should ignore tool calls", async () => {
      const checkpointer = new MemorySaver();
      const agent = createAgent({
        llm,
        middleware: [
          humanInTheLoopMiddleware({
            toolConfigs: {
              calculator: {
                requireApproval: true,
              },
            },
          }),
        ] as const,
        tools: [calculator],
        responseFormat: z.object({
          result: z.number().describe("The result of the calculation"),
        }),
        checkpointer,
      });

      const result = await agent.invoke(
        {
          messages: [new HumanMessage("Calculate 42 * 17")],
        },
        thread
      );

      const interruptRequests = result.__interrupt__?.[0].value as any;
      const resume = await agent.invoke(
        new Command({
          resume: [
            {
              id: interruptRequests[0].toolCallId,
              type: "ignore",
            },
          ],
        }),
        thread
      );
      expect(resume.messages).toHaveLength(4);
      const lastToolMessage = resume.messages
        .filter(ToolMessage.isInstance)
        .at(-1);
      expect(lastToolMessage?.content).toMatch(
        /User ignored the tool call for calculator with id/
      );
      expect(resume).not.toHaveProperty("structuredResponse");
    });

    it("should respond to tool calls", async () => {
      const checkpointer = new MemorySaver();
      const agent = createAgent({
        llm,
        middleware: [
          humanInTheLoopMiddleware({
            toolConfigs: {
              calculator: {
                requireApproval: true,
              },
            },
          }),
        ] as const,
        tools: [calculator],
        responseFormat: z.object({
          result: z.number().describe("The result of the calculation"),
        }),
        checkpointer,
      });

      const result = await agent.invoke(
        {
          messages: [new HumanMessage("What is 123 + 456?")],
        },
        thread
      );

      const interruptRequests = result.__interrupt__?.[0].value as any;
      const resume = await agent.invoke(
        new Command({
          resume: [
            {
              id: interruptRequests[0].toolCallId,
              type: "response",
              args: "The calculation result is 500 (custom override)",
            },
          ],
        }),
        thread
      );

      /**
       * we never know if the model will return 500 or 579
       */
      expect([500, 579].includes(resume.structuredResponse.result)).toBe(true);
    });

    it("should respond with structured response for approved tool calls and custom response", async () => {
      const checkpointer = new MemorySaver();
      const agent = createAgent({
        llm,
        middleware: [
          humanInTheLoopMiddleware({
            toolConfigs: {
              calculator: {
                requireApproval: true,
              },
              name_generator: {
                requireApproval: true,
              },
            },
          }),
        ] as const,
        tools: [calculator, nameGenerator],
        responseFormat: z.object({
          result: z.number().describe("The result of the calculation"),
          name: z.string().describe("A name of a person"),
        }),
        checkpointer,
      });

      const result = await agent.invoke(
        {
          messages: [
            new HumanMessage(
              "What is 123 + 456? And give me a name of a person?"
            ),
          ],
        },
        thread
      );

      const interruptRequests = result.__interrupt__?.[0].value as any;
      const resume = await agent.invoke(
        new Command({
          resume: [
            {
              id: interruptRequests[0].toolCallId,
              type: "response",
              args: "The calculation result is 500 (custom override)",
            },
            {
              id: interruptRequests[1].toolCallId,
              type: "accept",
            },
          ],
        }),
        thread
      );
      expect(resume.structuredResponse).toEqual({
        result: expect.toBeOneOf([500, 579]),
        name: "Thomas",
      });
    });
  });
});
