/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { describe, it, expect } from "vitest";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
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

const model = new ChatOpenAI({ model: "gpt-4o" });
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
        model,
        middleware: [
          humanInTheLoopMiddleware({
            toolConfigs: {
              calculator: true,
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
      expect(interruptRequests).toMatchInlineSnapshot(`
        [
          {
            "actionRequest": {
              "action": "calculator",
              "args": {
                "a": 42,
                "b": 17,
                "operation": "multiply",
              },
            },
            "config": {
              "allowAccept": true,
              "allowEdit": true,
              "allowRespond": true,
            },
            "description": "Tool execution requires approval

        Tool: calculator
        Args: {
          "a": 42,
          "b": 17,
          "operation": "multiply"
        }",
          },
        ]
      `);

      expect(result).not.toHaveProperty("structuredResponse");

      const resume = await agent.invoke(
        new Command({
          resume: [{ type: "accept" }],
        }),
        thread
      );
      expect(resume).toHaveProperty("structuredResponse");
      expect(resume.structuredResponse).toEqual({ result: 714 });
    });

    /**
     * This test has to be retried because the model sometimes may
     * rerun the tool due to the edit.
     */
    it("should edit tool calls", { retry: 3 }, async () => {
      const checkpointer = new MemorySaver();
      const draftEmailTool = tool(
        () => {
          return "Draft email";
        },
        {
          name: "draft_email",
          description: "Drafts an email",
          schema: z.object({
            message: z.string(),
            to: z.array(z.string()),
            subject: z.string(),
          }),
        }
      );
      const agent = createAgent({
        model,
        middleware: [
          humanInTheLoopMiddleware({
            toolConfigs: {
              draft_email: true,
            },
          }),
        ] as const,
        tools: [draftEmailTool],
        responseFormat: z.object({
          success: z
            .boolean()
            .describe("Whether the email was drafted successfully"),
        }),
        checkpointer,
      });

      const result = await agent.invoke(
        {
          messages: [
            new HumanMessage("Draft an email to John Doe, saying hello"),
          ],
        },
        thread
      );

      const editedMessage =
        "Hello John Doe,\n\nI hope this message finds you well! Just wanted to say hello.\n\nBest regards,\nHans Claasen";
      const interruptRequests = result.__interrupt__?.[0].value as any;
      const resume = await agent.invoke(
        new Command({
          resume: [
            {
              type: "edit",
              args: {
                action: "draft_email",
                args: {
                  ...interruptRequests[0].actionRequest.args,
                  message: editedMessage,
                  to: ["john.doe@example.com"],
                  subject: "Hello",
                },
              },
            },
          ],
        }),
        thread
      );
      expect(resume).toHaveProperty("structuredResponse");
      expect(resume.structuredResponse).toEqual({
        success: true,
      });

      const firstAIMessage = resume.messages.find(
        AIMessage.isInstance
      ) as AIMessage;
      expect(firstAIMessage.tool_calls).toEqual([
        {
          id: expect.any(String),
          name: "draft_email",
          args: {
            message: editedMessage,
            to: ["john.doe@example.com"],
            subject: "Hello",
          },
        },
      ]);
    });

    it("should respond to tool calls", async () => {
      const checkpointer = new MemorySaver();
      const agent = createAgent({
        model,
        middleware: [
          humanInTheLoopMiddleware({
            toolConfigs: {
              calculator: true,
            },
          }),
        ] as const,
        tools: [calculator],
        responseFormat: z.object({
          result: z.number().describe("The result of the calculation"),
        }),
        checkpointer,
      });

      await agent.invoke(
        {
          messages: [new HumanMessage("What is 123 + 456?")],
        },
        thread
      );

      const resume = await agent.invoke(
        new Command({
          resume: [
            {
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
        model,
        middleware: [
          humanInTheLoopMiddleware({
            toolConfigs: {
              calculator: true,
              name_generator: true,
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

      await agent.invoke(
        {
          messages: [
            new HumanMessage(
              "What is 123 + 456? And give me a name of a person?"
            ),
          ],
        },
        thread
      );

      const resume = await agent.invoke(
        new Command({
          resume: [
            {
              type: "response",
              args: "The calculation result is 500 (custom override)",
            },
            {
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
