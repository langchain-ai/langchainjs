import { z } from "zod/v3";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { tool } from "@langchain/core/tools";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph-checkpoint";

import { createAgent } from "../../index.js";
import {
  humanInTheLoopMiddleware,
  type HITLRequest,
  type HITLResponse,
  type InterruptOnConfig,
  type DecisionType,
  type Decision,
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

describe("humanInTheLoopMiddleware - New Schema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should auto-approve safe tools and interrupt for tools requiring approval", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["approve", "reject"],
          description: "⚠️ File write operation requires approval",
        },
        calculator: false,
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "calculator",
            args: { a: 42, b: 17, operation: "multiply" },
          },
        ],
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
      tools: [calculateTool, writeFileTool],
      middleware: [hitlMiddleware] as const,
    });

    const config = {
      configurable: {
        thread_id: "test-auto-approve",
      },
    };

    // Test 1: Calculator tool (auto-approved)
    const mathResult = await agent.invoke(
      {
        messages: [new HumanMessage("Calculate 42 * 17")],
      },
      config
    );

    expect(calculatorFn).toHaveBeenCalledTimes(1);
    expect(writeFileFn).not.toHaveBeenCalled();

    // Test 2: Write file tool (requires approval)
    model.index = 1;
    await agent.invoke(
      {
        messages: [new HumanMessage("Write 'Hello World' to greeting.txt")],
      },
      config
    );

    expect(writeFileFn).not.toHaveBeenCalled();

    const state = await agent.graph.getState(config);
    expect(state.next).toBeDefined();
    expect(state.next.length).toBe(1);

    const task = state.tasks?.[0];
    expect(task).toBeDefined();
    expect(task.interrupts).toBeDefined();
    expect(task.interrupts.length).toBe(1);

    const hitlRequest = task.interrupts[0].value as HITLRequest;
    expect(hitlRequest).toMatchObject({
      actionRequests: [
        {
          name: "write_file",
          arguments: {
            filename: "greeting.txt",
            content: "Hello World",
          },
        },
      ],
      reviewConfigs: [
        {
          allowedDecisions: ["approve", "reject"],
        },
      ],
    });

    // Resume with approval
    model.index = 1;
    await agent.invoke(
      new Command({
        resume: { decisions: [{ type: "approve" }] },
      }),
      config
    );

    expect(writeFileFn).toHaveBeenCalledTimes(1);
  });

  it("should handle approve decision", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        calculator: {
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
            args: { a: 10, b: 5, operation: "add" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [calculateTool],
      middleware: [hitlMiddleware] as const,
    });

    const config = {
      configurable: {
        thread_id: "test-approve",
      },
    };

    await agent.invoke(
      {
        messages: [new HumanMessage("Calculate 10 + 5")],
      },
      config
    );

    const result = await agent.invoke(
      new Command({
        resume: { decisions: [{ type: "approve" }] },
      }),
      config
    );

    expect(calculatorFn).toHaveBeenCalledTimes(1);
    expect(result.messages[result.messages.length - 1].content).toBe(
      "10 + 5 = 15"
    );
  });

  it("should handle edit decision with editedAction", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["approve", "edit"],
        },
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

    await agent.invoke(
      {
        messages: [new HumanMessage("Write dangerous content")],
      },
      config
    );

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
        },
      }),
      config
    );

    expect(writeFileFn).toHaveBeenCalledTimes(1);
    expect(writeFileFn).toHaveBeenCalledWith(
      {
        filename: "safe.txt",
        content: "Safe content",
      },
      expect.anything()
    );
  });

  it("should handle reject decision with message", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
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
            name: "write_file",
            args: { filename: "blocked.txt", content: "Blocked content" },
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
        thread_id: "test-reject",
      },
    };

    await agent.invoke(
      {
        messages: [new HumanMessage("Write blocked content")],
      },
      config
    );

    const result = await agent.invoke(
      new Command({
        resume: {
          decisions: [
            {
              type: "reject",
              message: "File operation not allowed in demo mode",
            },
          ],
        },
      }),
      config
    );

    expect(writeFileFn).not.toHaveBeenCalled();
    expect(result.messages[result.messages.length - 1].content).toBe(
      "File operation not allowed in demo mode"
    );
    expect(
      (result.messages[result.messages.length - 1] as ToolMessage).tool_call_id
    ).toBe("call_1");
  });

  it("should handle reject decision without message", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        calculator: {
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
            args: { a: 5, b: 3, operation: "add" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [calculateTool],
      middleware: [hitlMiddleware] as const,
    });

    const config = {
      configurable: {
        thread_id: "test-reject-no-msg",
      },
    };

    await agent.invoke(
      {
        messages: [new HumanMessage("Calculate 5 + 3")],
      },
      config
    );

    const result = await agent.invoke(
      new Command({
        resume: {
          decisions: [{ type: "reject" }],
        },
      }),
      config
    );

    expect(calculatorFn).not.toHaveBeenCalled();
    expect(result.messages[result.messages.length - 1].content).toContain(
      "User rejected the tool call"
    );
  });

  it("should handle multiple interrupted tools", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["approve", "edit"],
        },
        calculator: {
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
      tools: [calculateTool, writeFileTool],
      middleware: [hitlMiddleware] as const,
    });

    const config = {
      configurable: {
        thread_id: "test-multiple",
      },
    };

    const initialResult = await agent.invoke(
      {
        messages: [new HumanMessage("Calculate and write")],
      },
      config
    );

    expect(calculatorFn).not.toHaveBeenCalled();
    expect(writeFileFn).not.toHaveBeenCalled();

    const interruptRequest = initialResult
      .__interrupt__?.[0] as Interrupt<HITLRequest>;
    expect(interruptRequest.value).toMatchObject({
      actionRequests: [
        {
          name: "calculator",
          arguments: { a: 42, b: 17, operation: "multiply" },
        },
        {
          name: "write_file",
          arguments: { filename: "greeting.txt", content: "Hello World" },
        },
      ],
      reviewConfigs: [
        { allowedDecisions: ["approve", "reject"] },
        { allowedDecisions: ["approve", "edit"] },
      ],
    });

    await agent.invoke(
      new Command({
        resume: {
          decisions: [
            { type: "approve" },
            {
              type: "edit",
              editedAction: {
                name: "write_file",
                arguments: { filename: "safe.txt", content: "Safe content" },
              },
            },
          ],
        },
      }),
      config
    );

    expect(calculatorFn).toHaveBeenCalledTimes(1);
    expect(writeFileFn).toHaveBeenCalledTimes(1);
    expect(writeFileFn).toHaveBeenCalledWith(
      {
        filename: "safe.txt",
        content: "Safe content",
      },
      expect.anything()
    );
  });

  it("should throw if wrong number of decisions provided", async () => {
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
      tools: [calculateTool, writeFileTool],
      middleware: [hitlMiddleware] as const,
    });

    const config = {
      configurable: {
        thread_id: "test-wrong-count",
      },
    };

    await agent.invoke(
      {
        messages: [new HumanMessage("Calculate and write")],
      },
      config
    );

    await expect(() =>
      agent.invoke(
        new Command({
          resume: { decisions: [{ type: "approve" }] }, // Only 1 decision for 2 tools
        }),
        config
      )
    ).rejects.toThrow(
      "Number of human decisions (1) does not match number of interrupted tool calls (2)."
    );
  });

  it("should throw if decision type not allowed", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: {
          allowedDecisions: ["edit"], // Only edit allowed
        },
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "test.txt", content: "Test" },
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
        thread_id: "test-not-allowed",
      },
    };

    await agent.invoke(
      {
        messages: [new HumanMessage("Write test")],
      },
      config
    );

    await expect(() =>
      agent.invoke(
        new Command({
          resume: { decisions: [{ type: "approve" }] }, // Try to approve when only edit allowed
        }),
        config
      )
    ).rejects.toThrow(
      "Decision type 'approve' is not allowed for tool 'write_file'. Expected one of: \"edit\""
    );
  });

  it("should support InterruptOnConfig with all decision types", async () => {
    const interruptConfig: InterruptOnConfig = {
      allowedDecisions: ["approve", "edit", "reject"],
      description: "Tool requires approval",
    };

    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: interruptConfig,
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "test.txt", content: "Test content" },
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
        thread_id: "test-all-decisions",
      },
    };

    await agent.invoke(
      {
        messages: [new HumanMessage("Write test content")],
      },
      config
    );

    const state = await agent.graph.getState(config);
    const task = state.tasks?.[0];
    const hitlRequest = task.interrupts[0].value as HITLRequest;

    expect(hitlRequest).toMatchObject({
      actionRequests: [
        {
          name: "write_file",
          arguments: { filename: "test.txt", content: "Test content" },
        },
      ],
      reviewConfigs: [
        {
          allowedDecisions: ["approve", "edit", "reject"],
        },
      ],
    });
    expect(writeFileFn).not.toHaveBeenCalled();
  });

  it("should support dynamic description factory", async () => {
    const descriptionFactory = vi.fn((toolCall, _state, _runtime) => {
      return `Dynamic: ${toolCall.name} with ${JSON.stringify(toolCall.args)}`;
    });

    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        calculator: {
          allowedDecisions: ["approve", "reject"],
          description: descriptionFactory,
        },
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "calculator",
            args: { a: 5, b: 3, operation: "add" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [calculateTool],
      middleware: [hitlMiddleware] as const,
    });

    const config = {
      configurable: {
        thread_id: "test-dynamic-desc",
      },
    };

    await agent.invoke(
      {
        messages: [new HumanMessage("Calculate 5 + 3")],
      },
      config
    );

    expect(descriptionFactory).toHaveBeenCalledTimes(1);

    const state = await agent.graph.getState(config);
    const task = state.tasks?.[0];
    const hitlRequest = task.interrupts[0].value as HITLRequest;

    expect(hitlRequest.actionRequests[0].description).toContain(
      "Dynamic: calculator"
    );
  });

  it("should validate DecisionType values", () => {
    const validDecisions: DecisionType[] = ["approve", "edit", "reject"];
    expect(validDecisions).toHaveLength(3);
    expect(validDecisions).toContain("approve");
    expect(validDecisions).toContain("edit");
    expect(validDecisions).toContain("reject");
  });

  it("should work with boolean true to allow all decisions", async () => {
    const hitlMiddleware = humanInTheLoopMiddleware({
      interruptOn: {
        calculator: true, // Should allow all decisions
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "calculator",
            args: { a: 8, b: 4, operation: "multiply" },
          },
        ],
      ],
    });

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      checkpointer,
      tools: [calculateTool],
      middleware: [hitlMiddleware] as const,
    });

    const config = {
      configurable: {
        thread_id: "test-boolean-true",
      },
    };

    await agent.invoke(
      {
        messages: [new HumanMessage("Calculate 8 * 4")],
      },
      config
    );

    const state = await agent.graph.getState(config);
    const task = state.tasks?.[0];
    const hitlRequest = task.interrupts[0].value as HITLRequest;

    expect(hitlRequest).toMatchObject({
      actionRequests: [
        {
          name: "calculator",
          arguments: { a: 8, b: 4, operation: "multiply" },
        },
      ],
      reviewConfigs: [
        {
          allowedDecisions: ["approve", "edit", "reject"],
        },
      ],
    });
  });
});
