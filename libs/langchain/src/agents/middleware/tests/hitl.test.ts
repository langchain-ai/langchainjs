import { z } from "zod/v3";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { tool } from "@langchain/core/tools";
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
});
