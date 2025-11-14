/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { describe, it, expect } from "vitest";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { Command } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";

import { tool } from "@langchain/core/tools";
import { createAgent, type Interrupt } from "../../index.js";
import {
  type HITLRequest,
  type HITLResponse,
  humanInTheLoopMiddleware,
} from "../hitl.js";

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
            interruptOn: {
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
      const hitlRequest = result.__interrupt__?.[0].value as any;
      expect(hitlRequest).toHaveProperty("actionRequests");
      expect(hitlRequest).toHaveProperty("reviewConfigs");
      expect(hitlRequest.actionRequests).toHaveLength(1);
      expect(hitlRequest.actionRequests).toMatchInlineSnapshot(`
        [
          {
            "args": {
              "a": 42,
              "b": 17,
              "operation": "multiply",
            },
            "description": "Tool execution requires approval

        Tool: calculator
        Args: {
          "a": 42,
          "b": 17,
          "operation": "multiply"
        }",
            "name": "calculator",
          },
        ]
      `);

      expect(result).not.toHaveProperty("structuredResponse");

      const resume = await agent.invoke(
        new Command({
          resume: { decisions: [{ type: "approve" }] },
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
            interruptOn: {
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
      const hitlRequest = result.__interrupt__?.[0].value as HITLRequest;
      const resume = await agent.invoke(
        new Command({
          resume: {
            decisions: [
              {
                type: "edit",
                editedAction: {
                  name: "draft_email",
                  args: {
                    ...hitlRequest.actionRequests[0].args,
                    message: editedMessage,
                    to: ["john.doe@example.com"],
                    subject: "Hello",
                  },
                },
              },
            ],
          } satisfies HITLResponse,
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
          type: "tool_call",
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
            interruptOn: {
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
          resume: {
            decisions: [
              {
                type: "reject",
                message: "The calculation result is 500 (custom override)",
              },
            ],
          } satisfies HITLResponse,
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
            interruptOn: {
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
          resume: {
            decisions: [
              {
                type: "reject",
              },
              {
                type: "approve",
              },
            ],
          } satisfies HITLResponse,
        }),
        thread
      );

      /**
       * we expect another interrupt as model updates the tool call
       */
      expect("__interrupt__" in resume).toBe(true);

      const lastMessage = resume.messages.at(-1) as AIMessage;
      const finalResume = await agent.invoke(
        new Command({
          resume: {
            decisions:
              lastMessage.tool_calls?.map(() => ({
                type: "approve",
              })) ?? [],
          } satisfies HITLResponse,
        }),
        thread
      );

      expect(finalResume.structuredResponse).toEqual({
        result: expect.toBeOneOf([500, 579]),
        name: "Thomas",
      });
      /**
       * we expect the final resume to have 8 messages:
       * 1. human message
       * 2. AI message with 2 calls
       * 3. Rejected tool message
       * 4. new tool call
       * 5. approved tool message
       * 6. approved tool message
       * 7. AI message with final response
       */
      expect(finalResume.messages).toHaveLength(7);
    });

    it("should allow to reject tool calls and give model feedback", async () => {
      const checkpointer = new MemorySaver();
      const sendEmailTool = tool(
        () => {
          return "Email sent!";
        },
        {
          name: "send_email",
          description: "Sends an email",
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
            interruptOn: {
              send_email: true,
            },
          }),
        ] as const,
        tools: [sendEmailTool],
        checkpointer,
      });

      const result = await agent.invoke(
        {
          messages: [
            new HumanMessage(
              "Send an email to john.doe@example.com, saying hello!"
            ),
          ],
        },
        thread
      );

      /**
       * first interception
       */
      expect("__interrupt__" in result).toBe(true);
      const resume = await agent.invoke(
        new Command({
          resume: {
            decisions: [
              {
                type: "reject",
                message:
                  "Send the email speaking like a pirate starting the message with 'Arrr, matey!'",
              },
            ],
          } satisfies HITLResponse,
        }),
        thread
      );

      /**
       * second interception, verify model as updated the tool call and approve
       */
      const interrupt = resume.__interrupt__?.[0] as Interrupt<HITLRequest>;
      expect(
        interrupt?.value?.actionRequests[0].args.message.startsWith(
          "Arrr, matey!"
        )
      ).toBe(true);
      const finalResume = await agent.invoke(
        new Command({
          resume: {
            decisions: [
              {
                type: "approve",
              },
            ],
          } satisfies HITLResponse,
        }),
        thread
      );
      const toolMessage = [...finalResume.messages]
        .reverse()
        .find(ToolMessage.isInstance);
      expect(toolMessage).toBeDefined();
      expect(toolMessage?.content).toBe("Email sent!");
    });
  });
});
