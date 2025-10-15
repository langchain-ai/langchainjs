import { z } from "zod/v3";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { tool } from "@langchain/core/tools";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph-checkpoint";

import { createAgent } from "../../index.js";
import {
  humanInTheLoopMiddleware,
  type HITLRequest,
  type HITLResponse,
  type Decision,
} from "../hitl.js";
import {
  FakeToolCallingModel,
  _AnyIdHumanMessage,
  _AnyIdToolMessage,
  _AnyIdAIMessage,
} from "../../tests/utils.js";
import type { Interrupt } from "../../types.js";

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
      middleware: [hitlMiddleware] as const,
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
            "arguments": {
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
      middleware: [hitlMiddleware] as const,
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
                arguments: { filename: "safe.txt", content: "Safe content" },
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
      middleware: [hitlMiddleware] as const,
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
      middleware: [hitlMiddleware] as const,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      middleware: [hitlMiddleware] as const,
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
            arguments: { filename: "safe.txt", content: "Safe content" },
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
      middleware: [hitlMiddleware] as const,
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
      middleware: [hitlMiddleware] as const,
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
      middleware: [hitlMiddleware] as const,
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
      middleware: [hitlMiddleware] as const,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invalidEditedAction: any = {
      name: 123, // Invalid: should be string
      arguments: { filename: "test.txt", content: "test" },
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
      middleware: [hitlMiddleware] as const,
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

    // Resume with invalid edited action (arguments is not an object)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invalidEditedAction: any = {
      name: "write_file",
      arguments: "not an object", // Invalid: should be object
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
      'Invalid edited action for tool "write_file": arguments must be an object'
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
      middleware: [hitlMiddleware] as const,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      middleware: [hitlMiddleware] as const,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      middleware: [hitlMiddleware] as const,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
});
