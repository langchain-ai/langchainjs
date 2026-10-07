import { z } from "zod/v3";
import { z as z4 } from "zod/v4";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { tool, type ClientTool } from "@langchain/core/tools";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph-checkpoint";

import { createAgent } from "../../index.js";
import {
  humanInTheLoopMiddleware,
  isToolApprovalInterrupt,
  type HITLRequest,
  type HITLResponse,
  type Decision,
  type InterruptOnConfig,
  type ToolApprovalRequest,
} from "../hitl.js";
import { toolErrorMiddleware } from "../toolError.js";
import { toolRetryMiddleware } from "../toolRetry.js";
import {
  FakeToolCallingModel,
  _AnyIdHumanMessage,
  _AnyIdToolMessage,
  _AnyIdAIMessage,
} from "../../tests/utils.js";
import type { Interrupt } from "../../types.js";
import type { AgentMiddleware, ToolCallRequest } from "../types.js";

const writeFileFn = vi.fn(
  async ({ filename, content }: { filename: string; content: string }) => {
    return `Successfully wrote ${content.length} characters to ${filename}`;
  }
);

const calculatorFn = vi.fn(
  async ({ a, b, operation }: { a: number; b: number; operation: string }) => {
    switch (operation) {
      case "add":
        return `${a} + ${b} = ${a + b}`;
      case "multiply":
        return `${a} * ${b} = ${a * b}`;
      default:
        return "Unknown operation";
    }
  }
);

// Define tools
const calculateTool = tool(calculatorFn, {
  name: "calculator",
  description: "Perform basic math operations",
  schema: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
    operation: z.enum(["add", "multiply"]).describe("Math operation"),
  }),
});

const writeFileTool = tool(writeFileFn, {
  name: "write_file",
  description: "Write content to a file",
  schema: z.object({
    filename: z.string().describe("Name of the file"),
    content: z.string().describe("Content to write"),
  }),
});

describe("humanInTheLoopMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should auto-approve safe tools and interrupt for tools requiring approval", async () => {
    // Configure HITL middleware
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["approve"],
          description: "⚠️ File write operation requires approval",
        },
        calculator: false,
      },
    });

    // Create agent with mocked LLM
    const model = new FakeToolCallingModel({
      toolCalls: [
        // First call: calculator tool (auto-approved)
        [
          {
            id: "call_1",
            name: "calculator",
            args: { a: 42, b: 17, operation: "multiply" },
          },
        ],
        // Second call: write_file tool (requires approval)
        [
          {
            id: "call_2",
            name: "write_file",
            args: { filename: "greeting.txt", content: "Hello World" },
          },
        ],
        [],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      systemPrompt:
        "You are a helpful assistant. Use the tools provided to help the user.",
      tools: [calculateTool, writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-123",
      },
    };

    // Test 1: Calculator tool (auto-approved)
    const mathResult = await agent.invoke(
      {
        messages: [new HumanMessage("Calculate 42 * 17")],
      },
      config
    );

    // Verify calculator was called
    expect(writeFileFn).not.toHaveBeenCalled();
    expect(calculatorFn).toHaveBeenCalledTimes(1);
    expect(calculatorFn).toHaveBeenCalledWith(
      {
        a: 42,
        b: 17,
        operation: "multiply",
      },
      expect.anything()
    );

    // Verify response
    const mathMessages = mathResult.messages;
    expect(mathMessages).toHaveLength(4);
    /**
     * 1st message: Human message with prompt
     */
    expect(HumanMessage.isInstance(mathMessages[0])).toBe(true);
    expect(mathMessages[0]).toEqual(
      new _AnyIdHumanMessage("Calculate 42 * 17")
    );
    /**
     * 2nd message: AIMessage calling tool
     */
    expect(AIMessage.isInstance(mathMessages[1])).toBe(true);
    expect(mathMessages[1].content).toEqual(
      expect.stringContaining("You are a helpful assistant.")
    );
    /**
     * 3rd message: ToolMessage with tool response
     */
    expect(ToolMessage.isInstance(mathMessages[2])).toBe(true);
    expect(mathMessages[2].content).toEqual(
      expect.stringContaining("42 * 17 = 714")
    );
    /**
     * 4th message: AI response
     */
    expect(AIMessage.isInstance(mathMessages[3])).toBe(true);
    expect(mathMessages[3].content).toEqual(
      expect.stringContaining("42 * 17 = 714")
    );

    // Test 2: Write file tool (requires approval)
    model.index = 1;
    await agent.invoke(
      {
        messages: [new HumanMessage("Write 'Hello World' to greeting.txt")],
      },
      config
    );

    // Verify write_file was NOT called yet
    expect(writeFileFn).not.toHaveBeenCalled();

    // Check if agent is paused for approval
    const state = await agent.graph.getState(config);
    expect(state.next).toBeDefined();
    expect(state.next.length).toBe(1);

    // Verify interrupt data
    const task = state.tasks?.[0];
    expect(task).toBeDefined();
    expect(task.interrupts).toBeDefined();
    expect(task.interrupts.length).toBe(1);

    const hitlRequest = task.interrupts[0].value as HITLRequest;
    expect(hitlRequest).toMatchInlineSnapshot(`
      {
        "actionRequests": [
          {
            "args": {
              "content": "Hello World",
              "filename": "greeting.txt",
            },
            "description": "⚠️ File write operation requires approval",
            "name": "write_file",
          },
        ],
        "reviewConfigs": [
          {
            "actionName": "write_file",
            "allowedDecisions": [
              "approve",
            ],
          },
        ],
      }
    `);

    // Resume with approval
    model.index = 1;
    const resumedResult = await agent.invoke(
      new Command({
        resume: { decisions: [{ type: "approve" }] } as HITLResponse,
      }),
      config
    );

    // Verify write_file was called after approval
    expect(writeFileFn).toHaveBeenCalledTimes(1);
    expect(writeFileFn).toHaveBeenCalledWith(
      {
        filename: "greeting.txt",
        content: "Hello World",
      },
      expect.anything()
    );

    // Verify final response
    const finalMessages = resumedResult.messages;
    expect(finalMessages[finalMessages.length - 1].content).toBe(
      "Successfully wrote 11 characters to greeting.txt"
    );
  });

  it("should handle edit response type", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: true,
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "dangerous.txt", content: "Dangerous content" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-edit",
      },
    };

    // Initial invocation
    await agent.invoke(
      {
        messages: [new HumanMessage("Write dangerous content")],
      },
      config
    );

    // Resume with edited args
    await agent.invoke(
      new Command({
        resume: {
          decisions: [
            {
              type: "edit",
              editedAction: {
                name: "write_file",
                args: { filename: "safe.txt", content: "Safe content" },
              },
            },
          ],
        } as HITLResponse,
      }),
      config
    );

    // Verify tool was called with edited args
    expect(writeFileFn).toHaveBeenCalledTimes(1);
    expect(writeFileFn).toHaveBeenCalledWith(
      {
        filename: "safe.txt",
        content: "Safe content",
      },
      expect.anything()
    );
  });

  it("should return to model without executing approved tools when any tool is rejected", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        calculator: {
          allowedDecisions: ["approve", "reject"],
        },
        write_file: {
          allowedDecisions: ["approve", "reject"],
        },
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "calculator",
            args: { a: 5, b: 5, operation: "add" },
          },
          {
            id: "call_2",
            name: "write_file",
            args: { filename: "approved.txt", content: "approved" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [calculateTool, writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-partial-reject",
      },
    };

    // Initial invocation
    await agent.invoke(
      {
        messages: [new HumanMessage("Calculate 5+5 and write to file")],
      },
      config
    );

    // Approve first, reject second
    const result = await agent.invoke(
      new Command({
        resume: {
          decisions: [
            { type: "approve" },
            { type: "reject", message: "File write not allowed" },
          ],
        } as HITLResponse,
      }),
      config
    );

    // Verify only the rejected tool call appears in tool messages
    const toolMessages = result.messages.filter((msg: BaseMessage) =>
      ToolMessage.isInstance(msg)
    ) as ToolMessage[];

    expect(toolMessages.length).toBe(1);
    expect(toolMessages[0]?.content).toBe("File write not allowed");
    expect(toolMessages[0]?.tool_call_id).toBe("call_2");
    expect(toolMessages[0]?.status).toBe("error");
    expect(toolMessages[0]?.name).toBe("write_file");

    // Verify the AI message contains both tool calls
    const aiMessage = result.messages
      .slice()
      .reverse()
      .find((msg: BaseMessage) => AIMessage.isInstance(msg)) as AIMessage;

    // When there are rejections, all tool calls remain in the AI message
    expect(aiMessage.tool_calls).toHaveLength(2);
    expect(aiMessage.tool_calls?.[0]).toMatchObject({
      id: "call_1",
      name: "calculator",
      args: { a: 5, b: 5, operation: "add" },
    });
    expect(aiMessage.tool_calls?.[1]).toMatchObject({
      id: "call_2",
      name: "write_file",
      args: { filename: "approved.txt", content: "approved" },
    });

    // When there are rejections, we go back to the model without executing approved tools, so neither tool should be executed
    expect(calculatorFn).not.toHaveBeenCalled();
    expect(writeFileFn).not.toHaveBeenCalled();

    // Verify state shows agent is ready to continue (model needs to process rejection)
    const stateAfterResume = await agent.graph.getState(config);
    expect(stateAfterResume.next).toBeDefined();
    expect(stateAfterResume.next.length).toBeGreaterThan(0);
  });

  it("should handle manual response type", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["reject"],
        },
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "manual.txt", content: "Manual content" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-manual",
      },
    };

    // Initial invocation
    await agent.invoke(
      {
        messages: [new HumanMessage("Write to manual file")],
      },
      config
    );

    // Resume with manual response
    const resumedResult = await agent.invoke(
      new Command({
        resume: {
          decisions: [
            {
              type: "reject",
              message: "File operation not allowed in demo mode",
            },
          ],
        } as HITLResponse,
      }),
      config
    );

    // Verify tool was NOT called
    expect(writeFileFn).not.toHaveBeenCalled();

    // Verify manual response was added
    const { messages } = resumedResult;
    expect(messages[messages.length - 1].content).toBe(
      "File operation not allowed in demo mode"
    );
    expect((messages[messages.length - 1] as ToolMessage).tool_call_id).toBe(
      "call_1"
    );
  });

  it("should generate default rejection message when message is not provided", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        calculator: {
          allowedDecisions: ["reject"],
        },
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_123",
            name: "calculator",
            args: { a: 3, b: 4, operation: "add" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [calculateTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-default-reject-msg",
      },
    };

    // Initial invocation
    await agent.invoke(
      {
        messages: [new HumanMessage("Calculate 3 + 4")],
      },
      config
    );

    // Resume with rejection but no message
    const result = await agent.invoke(
      new Command({
        resume: {
          decisions: [
            {
              type: "reject",
              // No message provided
            },
          ],
        } as HITLResponse,
      }),
      config
    );

    // Verify default rejection message was generated
    const toolMessage = result.messages
      .slice()
      .reverse()
      .find((msg: BaseMessage) => ToolMessage.isInstance(msg)) as ToolMessage;

    expect(toolMessage).toBeDefined();
    expect(toolMessage.content).toBe(
      "User rejected the tool call for `calculator` with id call_123"
    );
    expect(toolMessage.tool_call_id).toBe("call_123");
  });

  it("should throw if response is not a string", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["reject"],
        },
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "manual.txt", content: "Manual content" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-manual",
      },
    };

    // Initial invocation
    await agent.invoke(
      {
        messages: [new HumanMessage("Write to manual file")],
      },
      config
    );

    // Resume with manual response - this should fail because message must be a string
    // but we're passing an object
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const invalidMessage: any = {
      action: "write_file",
      args: "File operation not allowed in demo mode",
    };
    await expect(() =>
      agent.invoke(
        new Command({
          resume: {
            decisions: [
              {
                type: "reject",
                message: invalidMessage,
              },
            ],
          } as HITLResponse,
        }),
        config
      )
    ).rejects.toThrow(
      'Tool call response for "write_file" must be a string, got object'
    );
  });

  it("should allow to interrupt multiple tools at the same time", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["edit"],
          description: "⚠️ File write operation requires approval",
        },
        calculator: true,
      },
    });

    // Create agent with mocked LLM
    const model = new FakeToolCallingModel({
      toolCalls: [
        // First call: calculator tool (auto-approved)
        [
          {
            id: "call_1",
            name: "calculator",
            args: { a: 42, b: 17, operation: "multiply" },
          },
          {
            id: "call_2",
            name: "write_file",
            args: { filename: "greeting.txt", content: "Hello World" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      systemPrompt:
        "You are a helpful assistant. Use the tools provided to help the user.",
      tools: [calculateTool, writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-123",
      },
    };

    // Initial invocation
    const initialResult = await agent.invoke(
      {
        messages: [
          new HumanMessage("Calculate 42 * 17 and write to greeting.txt"),
        ],
      },
      config
    );

    // not called due to interrupt
    expect(calculatorFn).toHaveBeenCalledTimes(0);
    expect(writeFileFn).toHaveBeenCalledTimes(0);

    const interruptRequest = initialResult
      .__interrupt__?.[0] as Interrupt<HITLRequest>;
    const hitlRequest = interruptRequest.value;
    const decisions: Decision[] = hitlRequest.actionRequests.map((action) => {
      if (action.name === "calculator") {
        return { type: "approve" };
      } else if (action.name === "write_file") {
        return {
          type: "edit",
          editedAction: {
            name: "write_file",
            args: { filename: "safe.txt", content: "Safe content" },
          },
        };
      }

      throw new Error(`Unknown action: ${action.name}`);
    });

    // Resume with approval
    await agent.invoke(
      new Command({ resume: { decisions } as HITLResponse }),
      config
    );

    // Verify tool was called
    expect(calculatorFn).toHaveBeenCalledTimes(1);
    expect(writeFileFn).toHaveBeenCalledTimes(1);
    expect(writeFileFn).toHaveBeenCalledWith(
      {
        filename: "safe.txt",
        content: "Safe content",
      },
      expect.anything()
    );
    expect(calculatorFn).toHaveBeenCalledWith(
      {
        a: 42,
        b: 17,
        operation: "multiply",
      },
      expect.anything()
    );
  });

  it("should throw if not all tool calls have a response", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["edit"],
          description: "⚠️ File write operation requires approval",
        },
        calculator: true,
      },
    });

    // Create agent with mocked LLM
    const model = new FakeToolCallingModel({
      toolCalls: [
        // First call: calculator tool (auto-approved)
        [
          {
            id: "call_1",
            name: "calculator",
            args: { a: 42, b: 17, operation: "multiply" },
          },
          {
            id: "call_2",
            name: "write_file",
            args: { filename: "greeting.txt", content: "Hello World" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      systemPrompt:
        "You are a helpful assistant. Use the tools provided to help the user.",
      tools: [calculateTool, writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-123",
      },
    };

    // Initial invocation
    await agent.invoke(
      {
        messages: [
          new HumanMessage("Calculate 42 * 17 and write to greeting.txt"),
        ],
      },
      config
    );

    // Resume with only one decision when two are needed
    await expect(() =>
      agent.invoke(
        new Command({
          resume: { decisions: [{ type: "approve" }] } as HITLResponse,
        }),
        config
      )
    ).rejects.toThrow(
      "Number of human decisions (1) does not match number of hanging tool calls (2)."
    );
  });

  it("should not allow me to approve if I don't have approve in allowedDecisions", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["edit"],
          description: "⚠️ File write operation requires approval",
        },
      },
    });

    // Create agent with mocked LLM
    const model = new FakeToolCallingModel({
      toolCalls: [
        // First call: calculator tool (auto-approved)
        [
          {
            id: "call_1",
            name: "calculator",
            args: { a: 42, b: 17, operation: "multiply" },
          },
          {
            id: "call_2",
            name: "write_file",
            args: { filename: "greeting.txt", content: "Hello World" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      systemPrompt:
        "You are a helpful assistant. Use the tools provided to help the user.",
      tools: [writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-123",
      },
    };

    // Initial invocation
    await agent.invoke(
      {
        messages: [
          new HumanMessage("Calculate 42 * 17 and write to greeting.txt"),
        ],
      },
      config
    );

    await expect(() =>
      agent.invoke(
        new Command({
          resume: { decisions: [{ type: "approve" }] } as HITLResponse,
        }),
        config
      )
    ).rejects.toThrow(
      'Unexpected human decision: {"type":"approve"}. Decision type \'approve\' is not allowed for tool \'write_file\'. Expected one of ["edit"] based on the tool\'s configuration.'
    );
  });

  it("should support dynamic description factory functions", async () => {
    // Create a description factory that formats based on tool call details
    const descriptionFactory = vi.fn((toolCall, _state, _runtime) => {
      return `Dynamic description for tool: ${toolCall.name}\nFile: ${toolCall.args.filename}\nContent length: ${toolCall.args.content.length} characters`;
    });

    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["approve", "edit"],
          description: descriptionFactory,
        },
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "dynamic.txt", content: "Hello Dynamic World" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-dynamic",
      },
    };

    // Initial invocation
    await agent.invoke(
      {
        messages: [new HumanMessage("Write dynamic content")],
      },
      config
    );

    // Verify the description factory was called
    expect(descriptionFactory).toHaveBeenCalledTimes(1);
    expect(descriptionFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "call_1",
        name: "write_file",
        args: { filename: "dynamic.txt", content: "Hello Dynamic World" },
      }),
      expect.objectContaining({
        messages: expect.any(Array),
      }),
      expect.objectContaining({
        context: expect.anything(),
      })
    );

    // Check the generated description in the interrupt
    const state = await agent.graph.getState(config);
    const task = state.tasks?.[0];
    const hitlRequest = task.interrupts[0].value as HITLRequest;

    expect(hitlRequest.actionRequests[0].description).toBe(
      "Dynamic description for tool: write_file\nFile: dynamic.txt\nContent length: 19 characters"
    );

    // Resume with approval
    await agent.invoke(
      new Command({
        resume: { decisions: [{ type: "approve" }] } as HITLResponse,
      }),
      config
    );

    // Verify tool was called
    expect(writeFileFn).toHaveBeenCalledTimes(1);
    expect(writeFileFn).toHaveBeenCalledWith(
      {
        filename: "dynamic.txt",
        content: "Hello Dynamic World",
      },
      expect.anything()
    );
  });

  it("should propagate argsSchema to ReviewConfig", async () => {
    const testSchema = {
      type: "object",
      properties: {
        filename: { type: "string" },
        content: { type: "string" },
      },
    };

    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["edit"],
          argsSchema: testSchema,
        },
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "test.txt", content: "test" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-args-schema",
      },
    };

    // Initial invocation
    const result = await agent.invoke(
      {
        messages: [new HumanMessage("Write to file")],
      },
      config
    );

    // Verify argsSchema was propagated to the interrupt request
    const interruptRequest = result
      .__interrupt__?.[0] as Interrupt<HITLRequest>;
    const hitlRequest = interruptRequest.value;

    expect(hitlRequest.reviewConfigs).toHaveLength(1);
    expect(hitlRequest.reviewConfigs[0]?.argsSchema).toEqual(testSchema);
  });

  it("should throw error when edited action has invalid name", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["edit"],
        },
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "test.txt", content: "test" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-invalid-name",
      },
    };

    // Initial invocation
    await agent.invoke(
      {
        messages: [new HumanMessage("Write test file")],
      },
      config
    );

    // Resume with invalid edited action (name is not a string)
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const invalidEditedAction: any = {
      name: 123, // Invalid: should be string
      args: { filename: "test.txt", content: "test" },
    };

    await expect(() =>
      agent.invoke(
        new Command({
          resume: {
            decisions: [
              {
                type: "edit",
                editedAction: invalidEditedAction,
              },
            ],
          } as HITLResponse,
        }),
        config
      )
    ).rejects.toThrow(
      'Invalid edited action for tool "write_file": name must be a string'
    );
  });

  it("should throw error when edited action has invalid arguments", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["edit"],
        },
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "test.txt", content: "test" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-invalid-arguments",
      },
    };

    // Initial invocation
    await agent.invoke(
      {
        messages: [new HumanMessage("Write test file")],
      },
      config
    );

    // Resume with invalid edited action (args is not an object)
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const invalidEditedAction: any = {
      name: "write_file",
      args: "not an object", // Invalid: should be object
    };

    await expect(() =>
      agent.invoke(
        new Command({
          resume: {
            decisions: [
              {
                type: "edit",
                editedAction: invalidEditedAction,
              },
            ],
          } as HITLResponse,
        }),
        config
      )
    ).rejects.toThrow(
      'Invalid edited action for tool "write_file": args must be an object'
    );
  });

  it("should throw error when edited action is missing", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["edit"],
        },
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "test.txt", content: "test" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-missing-edited-action",
      },
    };

    // Initial invocation
    await agent.invoke(
      {
        messages: [new HumanMessage("Write test file")],
      },
      config
    );

    // Resume with missing editedAction
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const invalidDecision: any = {
      type: "edit",
      // editedAction is missing
    };

    await expect(() =>
      agent.invoke(
        new Command({
          resume: {
            decisions: [invalidDecision],
          } as HITLResponse,
        }),
        config
      )
    ).rejects.toThrow(
      'Invalid edited action for tool "write_file": name must be a string'
    );
  });

  it("should throw error when decisions array is not provided", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["approve"],
        },
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "test.txt", content: "test" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-no-decisions",
      },
    };

    // Initial invocation
    await agent.invoke(
      {
        messages: [new HumanMessage("Write test file")],
      },
      config
    );

    // Resume with invalid HITLResponse (no decisions array)
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const invalidResponse: any = {
      // decisions is missing
    };

    await expect(() =>
      agent.invoke(
        new Command({
          resume: invalidResponse,
        }),
        config
      )
    ).rejects.toThrow(
      "Invalid HITLResponse: decisions must be a non-empty array"
    );
  });

  it("should throw error when decisions is not an array", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["approve"],
        },
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "test.txt", content: "test" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [writeFileTool],
      middleware: [hitlMiddleware],
    });

    const config = {
      configurable: {
        thread_id: "test-decisions-not-array",
      },
    };

    // Initial invocation
    await agent.invoke(
      {
        messages: [new HumanMessage("Write test file")],
      },
      config
    );

    // Resume with invalid HITLResponse (decisions is not an array)
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const invalidResponse: any = {
      decisions: "not an array",
    };

    await expect(() =>
      agent.invoke(
        new Command({
          resume: invalidResponse,
        }),
        config
      )
    ).rejects.toThrow(
      "Invalid HITLResponse: decisions must be a non-empty array"
    );
  });

  describe("tool call ordering", () => {
    it("should reproduce ordering bug with HITL middleware", async () => {
      /**
       * This test uses the actual HITL middleware and reproduces the ordering bug.
       *
       * Original order: [calc1, write1, calc2, write2]
       * Buggy code produces: [calc1, calc2, write1, write2]
       *
       * This test will FAIL with the buggy code and PASS with the fix.
       */
      const hitlMiddleware = humanInTheLoopMiddleware({
        interruptOn: {
          write_file: {
            allowedDecisions: ["approve"],
          },
          calculator: false, // Auto-approved
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              id: "call_1",
              name: "calculator",
              args: { a: 1, b: 2, operation: "add" },
            },
            {
              id: "call_2",
              name: "write_file",
              args: { filename: "file1.txt", content: "Content 1" },
            },
            {
              id: "call_3",
              name: "calculator",
              args: { a: 3, b: 4, operation: "add" },
            },
            {
              id: "call_4",
              name: "write_file",
              args: { filename: "file2.txt", content: "Content 2" },
            },
          ],
        ],
      });

      const checkpointer = new MemorySaver();
      const agent = createAgent({
        model,
        checkpointer,
        tools: [calculateTool, writeFileTool],
        middleware: [hitlMiddleware],
      });

      const config = {
        configurable: {
          thread_id: "test-order-bug-reproduction",
        },
      };

      // Step 1: Initial invocation - should interrupt
      const initialResult = await agent.invoke(
        {
          messages: [
            new HumanMessage(
              "Calculate 1+2, write file1, calculate 3+4, write file2"
            ),
          ],
        },
        config
      );

      // Verify interrupt occurred
      expect(initialResult.__interrupt__).toBeDefined();

      // Step 2: Get state before resume to see original order
      const stateBeforeResume = await agent.graph.getState(config);
      const aiMessageBeforeResume = stateBeforeResume.values.messages
        .slice()
        .reverse()
        .find((msg: BaseMessage) => AIMessage.isInstance(msg)) as AIMessage;

      // Verify original order is correct
      expect(aiMessageBeforeResume.tool_calls).toHaveLength(4);
      expect(aiMessageBeforeResume.tool_calls?.[0]?.id).toBe("call_1");
      expect(aiMessageBeforeResume.tool_calls?.[1]?.id).toBe("call_2");
      expect(aiMessageBeforeResume.tool_calls?.[2]?.id).toBe("call_3");
      expect(aiMessageBeforeResume.tool_calls?.[3]?.id).toBe("call_4");

      // Step 3: Resume with approvals - this is where the middleware processes decisions
      // The middleware returns { messages: [lastMessage, ...artificialToolMessages] }
      // where lastMessage.tool_calls has been updated
      const resumeResult = await agent.invoke(
        new Command({
          resume: {
            decisions: [{ type: "approve" }, { type: "approve" }],
          } as HITLResponse,
        }),
        config
      );

      // Step 4: Check the messages returned by the resume
      // The middleware should have updated the tool_calls array order
      // Find the AI message in the resume result that has our tool calls
      const resumeMessages = resumeResult.messages || [];
      const modifiedAIMessage = resumeMessages.find(
        (msg) =>
          AIMessage.isInstance(msg) &&
          msg.tool_calls?.length === 4 &&
          msg.tool_calls.find((tc) => tc.id === "call_1") &&
          msg.tool_calls.find((tc) => tc.id === "call_2") &&
          msg.tool_calls.find((tc) => tc.id === "call_3") &&
          msg.tool_calls.find((tc) => tc.id === "call_4")
      ) as AIMessage;

      expect(modifiedAIMessage).toBeDefined();
      expect(modifiedAIMessage?.tool_calls).toHaveLength(4);

      const actualOrder = modifiedAIMessage?.tool_calls?.map((tc) => tc.id);
      const actualNames = modifiedAIMessage?.tool_calls?.map((tc) => tc.name);

      expect(actualOrder).toEqual(["call_1", "call_2", "call_3", "call_4"]);
      expect(actualNames).toEqual([
        "calculator",
        "write_file",
        "calculator",
        "write_file",
      ]);

      // Verify each position individually for clearer error messages
      expect(modifiedAIMessage?.tool_calls?.[0]?.id).toBe("call_1");
      expect(modifiedAIMessage?.tool_calls?.[0]?.name).toBe("calculator");
      expect(modifiedAIMessage?.tool_calls?.[1]?.id).toBe("call_2");
      expect(modifiedAIMessage?.tool_calls?.[1]?.name).toBe("write_file");
      expect(modifiedAIMessage?.tool_calls?.[2]?.id).toBe("call_3");
      expect(modifiedAIMessage?.tool_calls?.[2]?.name).toBe("calculator");
      expect(modifiedAIMessage?.tool_calls?.[3]?.id).toBe("call_4");
      expect(modifiedAIMessage?.tool_calls?.[3]?.name).toBe("write_file");
    });

    it("should preserve original order when mixing auto-approved and interrupt tool calls", async () => {
      const hitlMiddleware = humanInTheLoopMiddleware({
        interruptOn: {
          write_file: {
            allowedDecisions: ["approve"],
            description: "⚠️ File write operation requires approval",
          },
          calculator: false, // Auto-approved
        },
      });

      // Create agent with mocked LLM that returns tool calls in specific order:
      // 1. calculator (auto-approved)
      // 2. write_file (interrupt)
      // 3. calculator (auto-approved)
      // 4. write_file (interrupt)
      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              id: "call_1",
              name: "calculator",
              args: { a: 1, b: 2, operation: "add" },
            },
            {
              id: "call_2",
              name: "write_file",
              args: { filename: "file1.txt", content: "Content 1" },
            },
            {
              id: "call_3",
              name: "calculator",
              args: { a: 3, b: 4, operation: "add" },
            },
            {
              id: "call_4",
              name: "write_file",
              args: { filename: "file2.txt", content: "Content 2" },
            },
          ],
        ],
      });

      const checkpointer = new MemorySaver();
      const agent = createAgent({
        model,
        checkpointer,
        tools: [calculateTool, writeFileTool],
        middleware: [hitlMiddleware],
      });

      const config = {
        configurable: {
          thread_id: "test-order-1",
        },
      };

      // Initial invocation
      const initialResult = await agent.invoke(
        {
          messages: [
            new HumanMessage(
              "Calculate 1+2, write file1, calculate 3+4, write file2"
            ),
          ],
        },
        config
      );

      // Verify interrupt occurred
      expect(initialResult.__interrupt__).toBeDefined();
      const interruptRequest = initialResult
        .__interrupt__?.[0] as Interrupt<HITLRequest>;
      const hitlRequest = interruptRequest.value;

      // Verify action requests are in order (only interrupt calls)
      expect(hitlRequest.actionRequests).toHaveLength(2);
      expect(hitlRequest.actionRequests[0]?.name).toBe("write_file");
      expect(hitlRequest.actionRequests[0]?.args.filename).toBe("file1.txt");
      expect(hitlRequest.actionRequests[1]?.name).toBe("write_file");
      expect(hitlRequest.actionRequests[1]?.args.filename).toBe("file2.txt");

      // Get the state to check tool calls order
      const state = await agent.graph.getState(config);
      const lastMessage = state.values.messages
        .slice()
        .reverse()
        .find((msg: unknown) => AIMessage.isInstance(msg)) as AIMessage;

      // Verify original tool calls order
      expect(lastMessage.tool_calls).toHaveLength(4);
      expect(lastMessage.tool_calls?.[0]?.name).toBe("calculator");
      expect(lastMessage.tool_calls?.[0]?.id).toBe("call_1");
      expect(lastMessage.tool_calls?.[1]?.name).toBe("write_file");
      expect(lastMessage.tool_calls?.[1]?.id).toBe("call_2");
      expect(lastMessage.tool_calls?.[2]?.name).toBe("calculator");
      expect(lastMessage.tool_calls?.[2]?.id).toBe("call_3");
      expect(lastMessage.tool_calls?.[3]?.name).toBe("write_file");
      expect(lastMessage.tool_calls?.[3]?.id).toBe("call_4");

      // Resume with approvals
      await agent.invoke(
        new Command({
          resume: {
            decisions: [{ type: "approve" }, { type: "approve" }],
          } as HITLResponse,
        }),
        config
      );

      // Verify tools were called in the correct order
      expect(calculatorFn).toHaveBeenCalledTimes(2);
      expect(writeFileFn).toHaveBeenCalledTimes(2);

      // Most importantly: Check that tool_calls array maintains original interleaved order
      // After resuming, get the final state and check the AI message tool_calls order
      const finalState = await agent.graph.getState(config);
      const finalAIMessage = finalState.values.messages
        .slice()
        .reverse()
        .find((msg: BaseMessage) => AIMessage.isInstance(msg)) as AIMessage;

      // Verify the tool_calls array preserves the original interleaved order:
      // [calc1, write1, calc2, write2] NOT [calc1, calc2, write1, write2]
      expect(finalAIMessage.tool_calls).toHaveLength(4);
      expect(finalAIMessage.tool_calls?.[0]?.id).toBe("call_1"); // calculator
      expect(finalAIMessage.tool_calls?.[0]?.name).toBe("calculator");
      expect(finalAIMessage.tool_calls?.[1]?.id).toBe("call_2"); // write_file
      expect(finalAIMessage.tool_calls?.[1]?.name).toBe("write_file");
      expect(finalAIMessage.tool_calls?.[2]?.id).toBe("call_3"); // calculator
      expect(finalAIMessage.tool_calls?.[2]?.name).toBe("calculator");
      expect(finalAIMessage.tool_calls?.[3]?.id).toBe("call_4"); // write_file
      expect(finalAIMessage.tool_calls?.[3]?.name).toBe("write_file");

      // Check call order by examining call arguments
      const calculatorCalls = calculatorFn.mock.calls;
      const writeFileCalls = writeFileFn.mock.calls;

      // First calculator call should be call_1 (1+2)
      expect(calculatorCalls[0]?.[0]).toEqual({
        a: 1,
        b: 2,
        operation: "add",
      });

      // First write_file call should be call_2 (file1.txt)
      expect(writeFileCalls[0]?.[0]).toEqual({
        filename: "file1.txt",
        content: "Content 1",
      });

      // Second calculator call should be call_3 (3+4)
      expect(calculatorCalls[1]?.[0]).toEqual({
        a: 3,
        b: 4,
        operation: "add",
      });

      // Second write_file call should be call_4 (file2.txt)
      expect(writeFileCalls[1]?.[0]).toEqual({
        filename: "file2.txt",
        content: "Content 2",
      });
    });

    it("should preserve order when some interrupt calls are rejected", async () => {
      const hitlMiddleware = humanInTheLoopMiddleware({
        interruptOn: {
          write_file: {
            allowedDecisions: ["approve", "reject"],
          },
          calculator: false, // Auto-approved
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              id: "call_1",
              name: "calculator",
              args: { a: 1, b: 2, operation: "add" },
            },
            {
              id: "call_2",
              name: "write_file",
              args: { filename: "file1.txt", content: "Content 1" },
            },
            {
              id: "call_3",
              name: "calculator",
              args: { a: 3, b: 4, operation: "add" },
            },
            {
              id: "call_4",
              name: "write_file",
              args: { filename: "file2.txt", content: "Content 2" },
            },
          ],
        ],
      });

      const checkpointer = new MemorySaver();
      const agent = createAgent({
        model,
        checkpointer,
        tools: [calculateTool, writeFileTool],
        middleware: [hitlMiddleware],
      });

      const config = {
        configurable: {
          thread_id: "test-order-reject",
        },
      };

      // Initial invocation
      await agent.invoke(
        {
          messages: [
            new HumanMessage(
              "Calculate 1+2, write file1, calculate 3+4, write file2"
            ),
          ],
        },
        config
      );

      // Resume with first approved, second rejected
      await agent.invoke(
        new Command({
          resume: {
            decisions: [
              { type: "approve" },
              { type: "reject", message: "File 2 not allowed" },
            ],
          } as HITLResponse,
        }),
        config
      );

      // Verify only first write_file was called (second was rejected)
      expect(calculatorFn).toHaveBeenCalledTimes(0); // Calculators not called because we're going back to model
      expect(writeFileFn).toHaveBeenCalledTimes(0); // No writes because we're going back to model

      // Check state - should have rejected tool message
      const state = await agent.graph.getState(config);
      const messages = state.values.messages;
      const toolMessages = messages.filter((msg: BaseMessage) =>
        ToolMessage.isInstance(msg)
      );

      // Should have one tool message for the rejected call
      expect(toolMessages.length).toBeGreaterThan(0);
      const rejectedMessage = toolMessages.find(
        (msg: ToolMessage) => msg.tool_call_id === "call_4"
      );
      expect(rejectedMessage).toBeDefined();
      expect(rejectedMessage?.content).toBe("File 2 not allowed");
    });

    it("should preserve order with multiple auto-approved tools between interrupts", async () => {
      const hitlMiddleware = humanInTheLoopMiddleware({
        interruptOn: {
          write_file: {
            allowedDecisions: ["approve"],
          },
          calculator: false, // Auto-approved
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              id: "call_1",
              name: "write_file",
              args: { filename: "file1.txt", content: "Content 1" },
            },
            {
              id: "call_2",
              name: "calculator",
              args: { a: 1, b: 2, operation: "add" },
            },
            {
              id: "call_3",
              name: "calculator",
              args: { a: 3, b: 4, operation: "add" },
            },
            {
              id: "call_4",
              name: "write_file",
              args: { filename: "file2.txt", content: "Content 2" },
            },
            {
              id: "call_5",
              name: "calculator",
              args: { a: 5, b: 6, operation: "add" },
            },
          ],
        ],
      });

      const checkpointer = new MemorySaver();
      const agent = createAgent({
        model,
        checkpointer,
        tools: [calculateTool, writeFileTool],
        middleware: [hitlMiddleware],
      });

      const config = {
        configurable: {
          thread_id: "test-order-multiple-auto",
        },
      };

      // Initial invocation
      const initialResult = await agent.invoke(
        {
          messages: [
            new HumanMessage(
              "Write file1, calculate 1+2, calculate 3+4, write file2, calculate 5+6"
            ),
          ],
        },
        config
      );

      // Verify interrupt occurred
      expect(initialResult.__interrupt__).toBeDefined();

      // Get the state to verify original order
      const state = await agent.graph.getState(config);
      const lastMessage = state.values.messages
        .slice()
        .reverse()
        .find((msg: BaseMessage) => AIMessage.isInstance(msg)) as AIMessage;

      // Verify original tool calls order
      expect(lastMessage.tool_calls).toHaveLength(5);
      expect(lastMessage.tool_calls?.[0]?.name).toBe("write_file");
      expect(lastMessage.tool_calls?.[0]?.id).toBe("call_1");
      expect(lastMessage.tool_calls?.[1]?.name).toBe("calculator");
      expect(lastMessage.tool_calls?.[1]?.id).toBe("call_2");
      expect(lastMessage.tool_calls?.[2]?.name).toBe("calculator");
      expect(lastMessage.tool_calls?.[2]?.id).toBe("call_3");
      expect(lastMessage.tool_calls?.[3]?.name).toBe("write_file");
      expect(lastMessage.tool_calls?.[3]?.id).toBe("call_4");
      expect(lastMessage.tool_calls?.[4]?.name).toBe("calculator");
      expect(lastMessage.tool_calls?.[4]?.id).toBe("call_5");

      // Resume with approvals
      await agent.invoke(
        new Command({
          resume: {
            decisions: [{ type: "approve" }, { type: "approve" }],
          } as HITLResponse,
        }),
        config
      );

      // Verify tools were called
      expect(calculatorFn).toHaveBeenCalledTimes(3);
      expect(writeFileFn).toHaveBeenCalledTimes(2);

      // Verify call order
      const calculatorCalls = calculatorFn.mock.calls;
      const writeFileCalls = writeFileFn.mock.calls;

      // First write_file should be file1.txt
      expect(writeFileCalls[0]?.[0].filename).toBe("file1.txt");

      // First calculator should be 1+2
      expect(calculatorCalls[0]?.[0]).toEqual({
        a: 1,
        b: 2,
        operation: "add",
      });

      // Second calculator should be 3+4
      expect(calculatorCalls[1]?.[0]).toEqual({
        a: 3,
        b: 4,
        operation: "add",
      });

      // Second write_file should be file2.txt
      expect(writeFileCalls[1]?.[0].filename).toBe("file2.txt");

      // Third calculator should be 5+6
      expect(calculatorCalls[2]?.[0]).toEqual({
        a: 5,
        b: 6,
        operation: "add",
      });
    });

    it("should preserve order when editing interrupt tool calls", async () => {
      const hitlMiddleware = humanInTheLoopMiddleware({
        interruptOn: {
          write_file: {
            allowedDecisions: ["approve", "edit"],
          },
          calculator: false, // Auto-approved
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              id: "call_1",
              name: "calculator",
              args: { a: 1, b: 2, operation: "add" },
            },
            {
              id: "call_2",
              name: "write_file",
              args: { filename: "original1.txt", content: "Original 1" },
            },
            {
              id: "call_3",
              name: "calculator",
              args: { a: 3, b: 4, operation: "add" },
            },
            {
              id: "call_4",
              name: "write_file",
              args: { filename: "original2.txt", content: "Original 2" },
            },
          ],
        ],
      });

      const checkpointer = new MemorySaver();
      const agent = createAgent({
        model,
        checkpointer,
        tools: [calculateTool, writeFileTool],
        middleware: [hitlMiddleware],
      });

      const config = {
        configurable: {
          thread_id: "test-order-edit",
        },
      };

      // Initial invocation
      await agent.invoke(
        {
          messages: [
            new HumanMessage(
              "Calculate 1+2, write file1, calculate 3+4, write file2"
            ),
          ],
        },
        config
      );

      // Resume with edits - edit first file, approve second
      await agent.invoke(
        new Command({
          resume: {
            decisions: [
              {
                type: "edit",
                editedAction: {
                  name: "write_file",
                  args: { filename: "edited1.txt", content: "Edited 1" },
                },
              },
              { type: "approve" },
            ],
          } as HITLResponse,
        }),
        config
      );

      // Verify tools were called in correct order
      expect(calculatorFn).toHaveBeenCalledTimes(2);
      expect(writeFileFn).toHaveBeenCalledTimes(2);

      const calculatorCalls = calculatorFn.mock.calls;
      const writeFileCalls = writeFileFn.mock.calls;

      // First calculator (1+2)
      expect(calculatorCalls[0]?.[0]).toEqual({
        a: 1,
        b: 2,
        operation: "add",
      });

      // First write_file should be edited version
      expect(writeFileCalls[0]?.[0]).toEqual({
        filename: "edited1.txt",
        content: "Edited 1",
      });

      // Second calculator (3+4)
      expect(calculatorCalls[1]?.[0]).toEqual({
        a: 3,
        b: 4,
        operation: "add",
      });

      // Second write_file should be original (approved)
      expect(writeFileCalls[1]?.[0]).toEqual({
        filename: "original2.txt",
        content: "Original 2",
      });
    });
  });

  describe("when predicate", () => {
    it("auto-approves the tool call when `when` returns false", async () => {
      const hitlMiddleware = humanInTheLoopMiddleware({
        interruptOn: {
          write_file: {
            allowedDecisions: ["approve"],
            when: (request) =>
              String(request.toolCall.args.filename ?? "").startsWith("danger"),
          },
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              id: "call_1",
              name: "write_file",
              args: { filename: "safe.txt", content: "Safe content" },
            },
          ],
          [],
        ],
      });

      const checkpointer = new MemorySaver();
      const agent = createAgent({
        model,
        checkpointer,
        tools: [writeFileTool],
        middleware: [hitlMiddleware],
      });

      const config = {
        configurable: { thread_id: "test-when-false" },
      };

      await agent.invoke(
        { messages: [new HumanMessage("Write to safe.txt")] },
        config
      );

      // The agent should run to completion without interrupting.
      const state = await agent.graph.getState(config);
      expect(state.next.length).toBe(0);
      expect(state.tasks?.[0]?.interrupts ?? []).toHaveLength(0);

      // The tool executed because the `when` predicate auto-approved it.
      expect(writeFileFn).toHaveBeenCalledTimes(1);
      expect(writeFileFn).toHaveBeenCalledWith(
        { filename: "safe.txt", content: "Safe content" },
        expect.anything()
      );
    });

    it("interrupts for the tool call when `when` returns true", async () => {
      const hitlMiddleware = humanInTheLoopMiddleware({
        interruptOn: {
          write_file: {
            allowedDecisions: ["approve"],
            when: (request) =>
              String(request.toolCall.args.filename ?? "").startsWith("danger"),
          },
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              id: "call_1",
              name: "write_file",
              args: { filename: "danger.txt", content: "Dangerous content" },
            },
          ],
        ],
      });

      const checkpointer = new MemorySaver();
      const agent = createAgent({
        model,
        checkpointer,
        tools: [writeFileTool],
        middleware: [hitlMiddleware],
      });

      const config = {
        configurable: { thread_id: "test-when-true" },
      };

      await agent.invoke(
        { messages: [new HumanMessage("Write to danger.txt")] },
        config
      );

      // The tool must not run until the human approves.
      expect(writeFileFn).not.toHaveBeenCalled();

      const state = await agent.graph.getState(config);
      expect(state.next.length).toBe(1);

      const task = state.tasks?.[0];
      expect(task?.interrupts).toHaveLength(1);
      const hitlRequest = task!.interrupts[0].value as HITLRequest;
      expect(hitlRequest.actionRequests).toHaveLength(1);
      expect(hitlRequest.actionRequests[0]?.name).toBe("write_file");
    });

    it("passes a ToolCallRequest with the correct values to `when`", async () => {
      const captured: ToolCallRequest[] = [];

      const hitlMiddleware = humanInTheLoopMiddleware({
        interruptOn: {
          write_file: {
            allowedDecisions: ["approve"],
            when: (request) => {
              captured.push(request);
              return true;
            },
          },
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              id: "tc-1",
              name: "write_file",
              args: { filename: "report.txt", content: "data" },
            },
          ],
        ],
      });

      const checkpointer = new MemorySaver();
      const agent = createAgent({
        model,
        checkpointer,
        tools: [writeFileTool],
        middleware: [hitlMiddleware],
      });

      const config = {
        configurable: { thread_id: "test-when-args" },
      };

      await agent.invoke(
        { messages: [new HumanMessage("Write report")] },
        config
      );

      expect(captured).toHaveLength(1);
      const request = captured[0]!;

      // The captured tool call matches the one emitted by the model.
      expect(request.toolCall).toEqual({
        id: "tc-1",
        name: "write_file",
        args: { filename: "report.txt", content: "data" },
        type: "tool_call",
      });

      // In batch mode the request is constructed without a concrete tool.
      expect(request.tool).toBeUndefined();

      // The request carries the live agent state: the human prompt followed by
      // the AI message whose tool call is being evaluated.
      expect(request.state.messages).toEqual([
        new _AnyIdHumanMessage("Write report"),
        expect.objectContaining({
          tool_calls: [
            expect.objectContaining({ id: "tc-1", name: "write_file" }),
          ],
        }),
      ]);
      const lastMessage =
        request.state.messages[request.state.messages.length - 1];
      expect(AIMessage.isInstance(lastMessage)).toBe(true);

      // The request exposes the node-level runtime.
      expect(request.runtime).toBeDefined();
      expect(request.runtime.configurable?.thread_id).toBe("test-when-args");
    });
  });
});

// --- Per-call mode (interruptMode: "per_call") ---

type Ran = [string, Record<string, unknown>][];
type ScriptedCall = {
  id?: string;
  name: string;
  args: Record<string, unknown>;
};

/** The parts of a JSON schema the per-call tests read. */
const JsonSchema = z4.looseObject({
  get oneOf() {
    return z4.array(JsonSchema).optional();
  },
  type: z4.string().optional(),
  const: z4.string().optional(),
  get properties() {
    return z4.record(z4.string(), JsonSchema).optional();
  },
  required: z4.array(z4.string()).optional(),
  additionalProperties: z4.unknown().optional(),
});
type JsonSchema = z4.infer<typeof JsonSchema>;

/** A Zod v4 tool that records each call in `ran`. */
const recordingTool = (
  ran: Ran,
  name: string,
  schema: z4.ZodObject | z.AnyZodObject
) =>
  tool(
    async (args: Record<string, unknown>) => {
      ran.push([name, args]);
      return `${name} done`;
    },
    { name, description: `Run ${name}.`, schema }
  );

const perCallTools = (ran: Ran) => [
  recordingTool(ran, "send_email", z4.object({ to: z4.string() })),
  recordingTool(ran, "delete_file", z4.object({ path: z4.string() })),
  recordingTool(ran, "read_file", z4.object({ path: z4.string() })),
];

const INTERRUPT_ON: Record<string, boolean | InterruptOnConfig> = {
  send_email: {
    allowedDecisions: ["approve", "edit", "reject"],
    description: "Email",
    // Not used in per-call mode: the edit's args come from the tool itself.
    argsSchema: {
      type: "object",
      properties: { recipient: { type: "string" } },
    },
  },
  delete_file: {
    allowedDecisions: ["approve", "reject"],
    description: "Delete",
  },
};

const THREE_CALLS: ScriptedCall[] = [
  { id: "call_email", name: "send_email", args: { to: "alice" } },
  { id: "call_delete", name: "delete_file", args: { path: "x.txt" } },
  { id: "call_read", name: "read_file", args: { path: "y.txt" } },
];
const EMAIL = THREE_CALLS.slice(0, 1);
const CFG = { configurable: { thread_id: "per-call" } }; // one checkpointer per agent

function perCallAgent(
  ran: Ran,
  toolCalls: ScriptedCall[],
  {
    interruptOn = INTERRUPT_ON,
    tools = perCallTools(ran),
    after = [],
    mode = "per_call",
  }: {
    interruptOn?: Record<string, boolean | InterruptOnConfig>;
    tools?: ClientTool[];
    after?: AgentMiddleware[];
    mode?: "batched" | "per_call";
  } = {}
) {
  return createAgent({
    model: new FakeToolCallingModel({ toolCalls: [toolCalls, []] }),
    tools,
    middleware: [
      humanInTheLoopMiddleware({ interruptOn, interruptMode: mode }),
      ...after,
    ],
    checkpointer: new MemorySaver(),
  });
}

type PerCallAgent = ReturnType<typeof perCallAgent>;
type Result = { messages: BaseMessage[]; __interrupt__?: Interrupt[] };

const approvals = (result: Result) =>
  (result.__interrupt__ ?? []).filter(isToolApprovalInterrupt);
const pause = async (agent: PerCallAgent) =>
  approvals(await agent.invoke({ messages: [new HumanMessage("go")] }, CFG));
const resume = (agent: PerCallAgent, answers: Record<string, unknown>) =>
  agent.invoke(new Command({ resume: answers }), CFG);
const byName = (interrupts: Interrupt<ToolApprovalRequest>[]) =>
  Object.fromEntries(interrupts.map((i) => [i.value.name, i]));
const toolMessages = (result: Result) =>
  Object.fromEntries(
    result.messages
      .filter(ToolMessage.isInstance)
      .map((m) => [m.tool_call_id, m])
  );
const edit = (
  name: string,
  args: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) => ({ type: "edit", edited_action: { name, args, ...extra } });

/** The interrupt's `response_schema`, as the JSON schema clients receive. */
const schemaOf = (intr: Interrupt) => JsonSchema.parse(intr.response_schema);
/** Decision type -> its branch. */
const branches = (schema: JsonSchema) =>
  Object.fromEntries(
    (schema.oneOf ?? [schema]).map((b) => [`${b.properties?.type?.const}`, b])
  );
/** The edit branch's `edited_action` schema and its `args` schema. */
const editParts = (schema: JsonSchema) => {
  const edited = branches(schema).edit?.properties?.edited_action ?? {};
  return [edited, edited.properties?.args ?? {}] as const;
};
/** `name`, starred when `schema` requires it. */
const starred = (schema: JsonSchema, name: string) =>
  schema.required?.includes(name) ? `${name}*` : name;

// The interrupt contract, checked the same way in langchain (Python): the value
// exactly, each decision's fields (required ones starred), and the edit's pinned
// name, argument types, and that it rejects unknown fields
// (`additionalProperties: false` at every level).
const EXPECTED_INTERRUPTS = {
  send_email: {
    value: {
      type: "tool_approval",
      tool_call_id: "call_email",
      name: "send_email",
      args: { to: "alice" },
      description: "Email",
    },
    decisions: { approve: [], edit: ["edited_action*"], reject: ["message"] },
    edited_action: {
      name: "send_email",
      args: { "to*": "string" },
      closed: true,
    },
  },
  delete_file: {
    value: {
      type: "tool_approval",
      tool_call_id: "call_delete",
      name: "delete_file",
      args: { path: "x.txt" },
      description: "Delete",
    },
    decisions: { approve: [], reject: ["message"] },
  },
};

/** The parts of an interrupt the contract covers. */
function normalize(intr: Interrupt<ToolApprovalRequest>) {
  const schema = schemaOf(intr);
  const byType = branches(schema);
  const normalized: Record<string, unknown> = {
    value: intr.value,
    decisions: Object.fromEntries(
      Object.entries(byType).map(([type, branch]) => [
        type,
        Object.keys(branch.properties ?? {})
          .filter((f) => f !== "type")
          .map((f) => starred(branch, f))
          .sort(),
      ])
    ),
  };
  if (byType.edit) {
    const [edited, args] = editParts(schema);
    normalized.edited_action = {
      name: edited.properties?.name?.const,
      args: Object.fromEntries(
        Object.entries(args.properties ?? {}).map(([k, v]) => [
          starred(args, k),
          v.type,
        ])
      ),
      closed: [byType.edit, edited, args].every(
        (part) => part.additionalProperties === false
      ),
    };
  }
  return normalized;
}

/** The validation issues behind a rejected resume, as `"code path"` strings. */
async function issuesOf(resumed: Promise<unknown>) {
  const error: unknown = await resumed.then(
    () => expect.fail("expected the answer to be rejected"),
    (e: Error) => e.cause ?? e
  );
  if (!(error instanceof z4.core.$ZodError)) {
    throw error;
  }
  return error.issues.map((i) => `${i.code} ${i.path.join(".")}`.trim());
}

describe('humanInTheLoopMiddleware({ interruptMode: "per_call" })', () => {
  it("pauses once per gated call and applies answers by ID", async () => {
    const ran: Ran = [];
    const agent = perCallAgent(ran, THREE_CALLS);
    const paused = byName(await pause(agent));
    expect(
      Object.fromEntries(
        Object.entries(paused).map(([name, i]) => [name, normalize(i)])
      )
    ).toEqual(EXPECTED_INTERRUPTS);
    expect(paused.send_email.id).not.toBe(paused.delete_file.id);
    expect(ran).toEqual([["read_file", { path: "y.txt" }]]); // the ungated call already ran
    expect(
      isToolApprovalInterrupt({ id: "i", value: { type: "tool_approval" } })
    ).toBe(false);

    const [pending] = approvals(
      await resume(agent, {
        [paused.send_email.id]: edit("send_email", { to: "bob" }),
      })
    );
    expect(pending.value.name).toBe("delete_file");
    const final = await resume(agent, {
      [pending.id]: { type: "reject", message: "keep it" },
    });

    expect(ran).toEqual([
      ["read_file", { path: "y.txt" }],
      ["send_email", { to: "bob" }],
    ]);
    const messages = toolMessages(final);
    expect(String(messages.call_email.content)).toContain(
      'Executed instead: send_email with arguments {"to":"bob"}.'
    );
    expect([messages.call_delete.content, messages.call_delete.status]).toEqual(
      ["keep it", "error"]
    );
    expect(approvals(final)).toEqual([]);
  });

  it("rejects each bad answer with one error at the problem, without saving it", async () => {
    const ran: Ran = [];
    const agent = perCallAgent(ran, THREE_CALLS.slice(0, 2), {
      interruptOn: { ...INTERRUPT_ON, send_email: true },
    });
    const paused = byName(await pause(agent));
    expect(Object.keys(branches(schemaOf(paused.send_email))).sort()).toEqual(
      ["approve", "edit", "reject"] // `true` allows all three
    );
    const editEmail = (args: object, extra = {}) =>
      edit("send_email", { ...args }, extra);
    const badAnswers = [
      [{ type: "edit" }, "invalid_type edited_action"],
      [editEmail({}), "invalid_type edited_action.args.to"],
      [editEmail({ to: 5 }), "invalid_type edited_action.args.to"],
      [edit("delete_file", { to: "b" }), "invalid_value edited_action.name"],
      [editEmail({ to: "b", ccc: 1 }), "unrecognized_keys edited_action.args"],
      [editEmail({ to: "b" }, { nmae: 1 }), "unrecognized_keys edited_action"],
    ] as const;
    for (const [answer, issue] of badAnswers) {
      const resumed = resume(agent, { [paused.send_email.id]: answer });
      expect(await issuesOf(resumed)).toEqual([issue]);
    }
    const notAllowed = edit("delete_file", { path: "y" }); // delete_file: approve/reject
    const resumed = resume(agent, { [paused.delete_file.id]: notAllowed });
    expect(await issuesOf(resumed)).toEqual(["invalid_union type"]);
    expect(ran).toEqual([]);

    await resume(agent, {
      [paused.send_email.id]: { type: "approve" },
      [paused.delete_file.id]: { type: "approve" },
    });
    expect(ran.map(([name]) => name).sort()).toEqual([
      "delete_file",
      "send_email",
    ]);
  });

  it("checks edits only against a Zod v4 tool schema", async () => {
    const setup = async (schema: z4.ZodObject | z.AnyZodObject) => {
      const ran: Ran = [];
      const agent = perCallAgent(ran, EMAIL, {
        interruptOn: { send_email: { allowedDecisions: ["edit"] } },
        tools: [recordingTool(ran, "send_email", schema)],
      });
      const [intr] = await pause(agent);
      const send = (args: object) =>
        resume(agent, { [intr.id]: edit("send_email", { ...args }) });
      return { ran, send, shown: editParts(schemaOf(intr))[1] };
    };

    // A loose schema keeps extra args
    const loose = await setup(z4.looseObject({ to: z4.string() }));
    await loose.send({ to: "b", cc: "c" });
    expect(loose.ran).toEqual([["send_email", { to: "b", cc: "c" }]]);

    // Other schemas take any object; the tool's own validation rejects it
    const v3 = await setup(z.object({ to: z.string() }));
    expect([v3.shown.type, v3.shown.properties]).toEqual(["object", undefined]);
    const final = await v3.send({ to: 5 });
    expect([v3.ran, toolMessages(final).call_email.status]).toEqual([
      [],
      "error",
    ]);
  });

  it("skips the interrupt when `when` returns false", async () => {
    const ran: Ran = [];
    const when = (request: ToolCallRequest) =>
      request.toolCall.args.to !== "alice";
    const agent = perCallAgent(ran, EMAIL, {
      interruptOn: { send_email: { allowedDecisions: ["approve"], when } },
    });
    expect(await pause(agent)).toEqual([]);
    expect(ran).toEqual([["send_email", { to: "alice" }]]);
  });

  it("needs a tool call ID but accepts an empty one", async () => {
    const ran: Ran = [];
    const noId = { name: "send_email", args: { to: "alice" } };
    await expect(pause(perCallAgent(ran, [noId]))).rejects.toThrow(
      /`send_email` has no ID/
    );

    const agent = perCallAgent(ran, [{ ...noId, id: "" }]);
    const [intr] = await pause(agent); // an empty ID still runs, as in batched mode
    expect(intr.value.tool_call_id).toBe("");
    await resume(agent, { [intr.id]: { type: "approve" } });
    expect(ran).toEqual([["send_email", { to: "alice" }]]);
  });

  it("routes each answer to its own call when the same tool is called twice", async () => {
    const ran: Ran = [];
    const agent = perCallAgent(ran, [
      { id: "e1", name: "send_email", args: { to: "alice" } },
      { id: "e2", name: "send_email", args: { to: "alice" } },
    ]);
    const ids = Object.fromEntries(
      (await pause(agent)).map((i) => [i.value.tool_call_id, i.id])
    );
    const final = await resume(agent, {
      [ids.e1]: { type: "approve" },
      [ids.e2]: { type: "reject" },
    });
    expect(ran).toEqual([["send_email", { to: "alice" }]]);
    expect(toolMessages(final).e2.status).toBe("error");
  });

  it("applies each answer of a multi-answer resume on its own", async () => {
    const ran: Ran = [];
    const agent = perCallAgent(ran, THREE_CALLS.slice(0, 2));
    const paused = byName(await pause(agent));
    const valid = { [paused.delete_file.id]: { type: "approve" } };

    await expect(
      resume(agent, { ...valid, [paused.send_email.id]: { type: "edit" } })
    ).rejects.toThrow(/edited_action/);
    expect(ran).toEqual([["delete_file", { path: "x.txt" }]]); // the valid answer ran

    // Resending an applied answer has no effect
    const final = await resume(agent, {
      [paused.send_email.id]: { type: "approve" },
      [paused.delete_file.id]: { type: "reject" },
    });
    expect(ran.map(([name]) => name)).toEqual(["delete_file", "send_email"]);
    expect(toolMessages(final).call_delete.status).toBe("success");
  });

  it("wraps retry and error-handling middleware listed after it", async () => {
    let attempts = 0;
    const flaky = tool(
      async ({ to }) => {
        attempts += 1;
        if (attempts === 1) throw new Error("mail server unavailable");
        return `sent to ${to}`;
      },
      {
        name: "send_email",
        description: "Send an email.",
        schema: z4.object({ to: z4.string() }),
      }
    );
    const agent = perCallAgent([], EMAIL, {
      tools: [flaky],
      after: [toolRetryMiddleware({ initialDelayMs: 0 })],
    });
    const [intr] = await pause(agent);
    // A bad answer still reaches the caller instead of being retried
    expect(
      await issuesOf(resume(agent, { [intr.id]: { type: "edit" } }))
    ).toEqual(["invalid_type edited_action"]);
    const final = await resume(agent, { [intr.id]: { type: "approve" } });
    expect(approvals(final)).toEqual([]); // the retry didn't ask the reviewer again
    expect([attempts, toolMessages(final).call_email.content]).toEqual([
      2,
      "sent to alice",
    ]);

    const caught = perCallAgent([], EMAIL, {
      after: [toolErrorMiddleware({ onError: () => "x" })],
    });
    const [paused] = await pause(caught);
    expect(
      await issuesOf(resume(caught, { [paused.id]: { type: "edit" } }))
    ).toEqual(["invalid_type edited_action"]);
  });

  it("adds the edit notice to a tool that returns a Command", async () => {
    const setFlag = tool(
      async ({ value }, { toolCall }) => {
        const message = new ToolMessage({
          content: `flag=${value}`,
          tool_call_id: toolCall?.id ?? "",
        });
        return new Command({ update: { messages: [message] } });
      },
      {
        name: "set_flag",
        description: "Set a flag.",
        schema: z4.object({ value: z4.string() }),
      }
    );
    const call = { id: "f1", name: "set_flag", args: { value: "a" } };
    const agent = perCallAgent([], [call], {
      interruptOn: { set_flag: true },
      tools: [setFlag],
    });
    const [intr] = await pause(agent);
    const final = await resume(agent, {
      [intr.id]: edit("set_flag", { value: "b" }),
    });
    expect(String(toolMessages(final).f1.content)).toMatch(
      /^Note: .* Executed instead: set_flag with arguments {"value":"b"}\.[\s\S]*flag=b$/
    );
  });

  it("checks its options, and leaves batched mode without wrapToolCall", () => {
    expect(() =>
      // @ts-expect-error JavaScript callers can pass anything
      humanInTheLoopMiddleware({ interruptMode: "sometimes" })
    ).toThrow(/interruptMode must be "batched" or "per_call", got "sometimes"/);
    expect(() =>
      humanInTheLoopMiddleware({
        interruptOn: { send_email: { allowedDecisions: [] } },
        interruptMode: "per_call",
      })
    ).toThrow(/allowedDecisions/);
    const perCall = humanInTheLoopMiddleware({
      interruptOn: { send_email: true },
      interruptMode: "per_call",
    });
    expect(() =>
      createAgent({
        model: new FakeToolCallingModel({ toolCalls: [] }),
        tools: perCallTools([]),
        version: "v1",
        middleware: [perCall],
      })
    ).toThrow(/version "v2"/);
    // A `wrapToolCall` would change how batched mode handles tool crashes
    expect(
      humanInTheLoopMiddleware({ interruptOn: INTERRUPT_ON }).wrapToolCall
    ).toBeUndefined();
  });
});
