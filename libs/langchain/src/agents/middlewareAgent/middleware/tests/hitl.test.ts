import { z } from "zod/v3";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { tool } from "@langchain/core/tools";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph-checkpoint";

import { createAgent } from "../../index.js";
import {
  humanInTheLoopMiddleware,
  type HumanInTheLoopRequest,
  type HumanInTheLoopMiddlewareHumanResponse,
} from "../hitl.js";
import {
  FakeToolCallingModel,
  _AnyIdHumanMessage,
  _AnyIdToolMessage,
  _AnyIdAIMessage,
} from "../../../tests/utils.js";
import type { Interrupt } from "../../../interrupt.js";

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
          allowAccept: true,
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
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      prompt:
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
    expect(mathMessages).toHaveLength(3);
    expect(mathMessages[0]).toEqual(
      new _AnyIdHumanMessage("Calculate 42 * 17")
    );
    expect(mathMessages[2].content).toBe("42 * 17 = 714");

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

    const requests = task.interrupts[0].value;
    expect(requests).toMatchInlineSnapshot(`
      [
        {
          "actionRequest": {
            "action": "write_file",
            "args": {
              "content": "Hello World",
              "filename": "greeting.txt",
            },
          },
          "config": {
            "allowAccept": true,
            "description": "⚠️ File write operation requires approval",
          },
          "description": "⚠️ File write operation requires approval",
        },
      ]
    `);

    // Resume with approval
    model.index = 1;
    const resumedResult = await agent.invoke(
      new Command({
        resume: [{ type: "accept" }],
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
        resume: [
          {
            type: "edit",
            args: {
              action: "write_file",
              args: { filename: "safe.txt", content: "Safe content" },
            },
          },
        ],
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
          allowRespond: true,
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
        resume: [
          {
            type: "response",
            args: "File operation not allowed in demo mode",
          },
        ],
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
          allowRespond: true,
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
    await expect(() =>
      agent.invoke(
        new Command({
          resume: [
            {
              type: "response",
              args: {
                action: "write_file",
                args: "File operation not allowed in demo mode",
              },
            },
          ],
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
          allowEdit: true,
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
      prompt:
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

    const interruptRequest = initialResult.__interrupt__?.[0] as Interrupt<
      HumanInTheLoopRequest[]
    >;
    const resume: HumanInTheLoopMiddlewareHumanResponse[] =
      interruptRequest.value.map(({ actionRequest }) => {
        if (actionRequest.action === "calculator") {
          return { type: "accept" };
        } else if (actionRequest.action === "write_file") {
          return {
            type: "edit",
            args: {
              action: "write_file",
              args: { filename: "safe.txt", content: "Safe content" },
            },
          };
        }

        throw new Error(`Unknown action: ${actionRequest.action}`);
      });

    // Resume with approval
    await agent.invoke(new Command({ resume }), config);

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
          allowEdit: true,
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
      prompt:
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

    // Resume with approval
    await expect(() =>
      agent.invoke(
        new Command({ resume: [{ id: "call_2", type: "ignore" }] }),
        config
      )
    ).rejects.toThrow(
      "Number of human responses (1) does not match number of hanging tool calls (2)."
    );
  });

  it("should not allow me to approve if I don't have allowAccept", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowEdit: true,
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
      prompt:
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
      agent.invoke(new Command({ resume: [{ type: "accept" }] }), config)
    ).rejects.toThrow(
      'Unexpected human response: {"type":"accept"}. Response action \'accept\' is not allowed for tool \'write_file\'. Expected one of: "edit", based on the tool\'s configuration.'
    );
  });
});
