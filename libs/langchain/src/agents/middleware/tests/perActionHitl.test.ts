import { z } from "zod/v3";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { tool } from "@langchain/core/tools";
import {
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph-checkpoint";

import { createAgent } from "../../index.js";
import {
  perActionHumanInTheLoopMiddleware,
  type HITLResponse,
  type Decision,
  type HITLRequest,
} from "../index.js";
import { FakeToolCallingModel } from "../../tests/utils.js";
import type { Interrupt } from "../../types.js";

const writeFileFn = vi.fn(
  async ({ filename, content }: { filename: string; content: string }) =>
    `Successfully wrote ${content.length} characters to ${filename}`
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

describe("perActionHumanInTheLoopMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute approved tool calls when another action in the same batch is rejected", async () => {
    const middleware = perActionHumanInTheLoopMiddleware({
      interruptOn: {
        calculator: true,
        write_file: true,
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
            args: { filename: "blocked.txt", content: "blocked" },
          },
        ],
      ],
    });

    const agent = createAgent({
      model,
      checkpointer: new MemorySaver(),
      tools: [calculateTool, writeFileTool],
      middleware: [middleware],
    });

    const config = { configurable: { thread_id: "pa-hitl-approve-reject" } };

    const initial = await agent.invoke(
      {
        messages: [
          new HumanMessage("Calculate 5 + 5 and write to blocked.txt"),
        ],
      },
      config
    );
    expect(initial.__interrupt__).toBeDefined();

    const resumed = await agent.invoke(
      new Command({
        resume: {
          decisions: [
            { type: "approve" },
            { type: "reject", message: "File writing is blocked" },
          ],
        } as HITLResponse,
      }),
      config
    );

    expect(calculatorFn).toHaveBeenCalledTimes(1);
    expect(calculatorFn).toHaveBeenCalledWith(
      { a: 5, b: 5, operation: "add" },
      expect.anything()
    );
    expect(writeFileFn).not.toHaveBeenCalled();

    const toolMessages = resumed.messages.filter((msg: BaseMessage) =>
      ToolMessage.isInstance(msg)
    ) as ToolMessage[];
    expect(toolMessages.some((msg) => msg.tool_call_id === "call_2")).toBe(
      true
    );
    expect(
      toolMessages.some((msg) => msg.content === "File writing is blocked")
    ).toBe(true);
  });

  it("should execute edited actions while rejected actions are converted to tool messages", async () => {
    const middleware = perActionHumanInTheLoopMiddleware({
      interruptOn: {
        write_file: true,
        calculator: true,
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "unsafe.txt", content: "unsafe-content" },
          },
          {
            id: "call_2",
            name: "calculator",
            args: { a: 2, b: 2, operation: "add" },
          },
        ],
      ],
    });

    const agent = createAgent({
      model,
      checkpointer: new MemorySaver(),
      tools: [calculateTool, writeFileTool],
      middleware: [middleware],
    });

    const config = { configurable: { thread_id: "pa-hitl-edit-reject" } };
    await agent.invoke(
      { messages: [new HumanMessage("Write file and do a calculation")] },
      config
    );

    const resumed = await agent.invoke(
      new Command({
        resume: {
          decisions: [
            {
              type: "edit",
              editedAction: {
                name: "write_file",
                args: { filename: "safe.txt", content: "safe-content" },
              },
            },
            {
              type: "reject",
              message: "Manual calculation policy in effect",
            },
          ],
        } as HITLResponse,
      }),
      config
    );

    expect(writeFileFn).toHaveBeenCalledTimes(1);
    expect(writeFileFn).toHaveBeenCalledWith(
      { filename: "safe.txt", content: "safe-content" },
      expect.anything()
    );
    expect(calculatorFn).not.toHaveBeenCalled();

    const toolMessages = resumed.messages.filter((msg: BaseMessage) =>
      ToolMessage.isInstance(msg)
    ) as ToolMessage[];
    expect(
      toolMessages.some(
        (msg) =>
          msg.tool_call_id === "call_2" &&
          msg.content === "Manual calculation policy in effect"
      )
    ).toBe(true);
  });

  it("should process all rejected actions without executing tools", async () => {
    const middleware = perActionHumanInTheLoopMiddleware({
      interruptOn: {
        calculator: true,
        write_file: true,
      },
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "calculator",
            args: { a: 1, b: 1, operation: "add" },
          },
          {
            id: "call_2",
            name: "write_file",
            args: { filename: "never.txt", content: "never" },
          },
        ],
      ],
    });

    const agent = createAgent({
      model,
      checkpointer: new MemorySaver(),
      tools: [calculateTool, writeFileTool],
      middleware: [middleware],
    });

    const config = { configurable: { thread_id: "pa-hitl-all-reject" } };
    await agent.invoke(
      { messages: [new HumanMessage("Do both actions")] },
      config
    );

    const resumed = await agent.invoke(
      new Command({
        resume: {
          decisions: [
            { type: "reject", message: "Rejected calculator" },
            { type: "reject", message: "Rejected file write" },
          ],
        } as HITLResponse,
      }),
      config
    );

    expect(calculatorFn).not.toHaveBeenCalled();
    expect(writeFileFn).not.toHaveBeenCalled();

    const toolMessages = resumed.messages.filter((msg: BaseMessage) =>
      ToolMessage.isInstance(msg)
    ) as ToolMessage[];
    expect(toolMessages.some((msg) => msg.tool_call_id === "call_1")).toBe(
      true
    );
    expect(toolMessages.some((msg) => msg.tool_call_id === "call_2")).toBe(
      true
    );
  });

  it("should preserve tool call order for mixed outcomes", async () => {
    const middleware = perActionHumanInTheLoopMiddleware({
      interruptOn: {
        calculator: true,
        write_file: true,
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
            args: { filename: "reject.txt", content: "reject" },
          },
          {
            id: "call_3",
            name: "calculator",
            args: { a: 3, b: 4, operation: "add" },
          },
          {
            id: "call_4",
            name: "write_file",
            args: { filename: "edit.txt", content: "old-content" },
          },
        ],
      ],
    });

    const agent = createAgent({
      model,
      checkpointer: new MemorySaver(),
      tools: [calculateTool, writeFileTool],
      middleware: [middleware],
    });

    const config = { configurable: { thread_id: "pa-hitl-order" } };
    const initial = await agent.invoke(
      {
        messages: [
          new HumanMessage(
            "Calculate 1+2, reject first write, calculate 3+4, edit second write"
          ),
        ],
      },
      config
    );

    const interruptRequest = initial
      .__interrupt__?.[0] as Interrupt<HITLRequest>;
    expect(
      interruptRequest.value.actionRequests.map((req) => req.name)
    ).toEqual(["calculator", "write_file", "calculator", "write_file"]);

    const decisions: Decision[] = interruptRequest.value.actionRequests.map(
      (actionRequest) => {
        if (actionRequest.name === "calculator" && actionRequest.args.a === 1) {
          return { type: "approve" };
        }
        if (
          actionRequest.name === "write_file" &&
          actionRequest.args.filename === "reject.txt"
        ) {
          return { type: "reject", message: "Reject first write" };
        }
        if (actionRequest.name === "calculator" && actionRequest.args.a === 3) {
          return { type: "approve" };
        }
        return {
          type: "edit",
          editedAction: {
            name: "write_file",
            args: { filename: "edited.txt", content: "new-content" },
          },
        };
      }
    );

    const resumed = await agent.invoke(
      new Command({
        resume: { decisions } as HITLResponse,
      }),
      config
    );

    expect(calculatorFn).toHaveBeenCalledTimes(2);
    expect(writeFileFn).toHaveBeenCalledTimes(1);
    expect(writeFileFn).toHaveBeenCalledWith(
      { filename: "edited.txt", content: "new-content" },
      expect.anything()
    );

    const rejectedToolMessage = resumed.messages.find(
      (msg) =>
        ToolMessage.isInstance(msg) &&
        msg.tool_call_id === "call_2" &&
        msg.content === "Reject first write"
    );
    expect(rejectedToolMessage).toBeDefined();
  });

  it("should throw on decision count mismatch", async () => {
    const middleware = perActionHumanInTheLoopMiddleware({
      interruptOn: { calculator: true, write_file: true },
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
            args: { filename: "x.txt", content: "x" },
          },
        ],
      ],
    });
    const agent = createAgent({
      model,
      checkpointer: new MemorySaver(),
      tools: [calculateTool, writeFileTool],
      middleware: [middleware],
    });
    const config = { configurable: { thread_id: "pa-hitl-count-mismatch" } };
    await agent.invoke(
      { messages: [new HumanMessage("Do two actions")] },
      config
    );

    await expect(() =>
      agent.invoke(
        new Command({
          resume: {
            decisions: [{ type: "approve" }],
          } as HITLResponse,
        }),
        config
      )
    ).rejects.toThrow(
      "Number of human decisions (1) does not match number of hanging tool calls (2)."
    );
  });

  it("should throw when disallowed decision type is used", async () => {
    const middleware = perActionHumanInTheLoopMiddleware({
      interruptOn: {
        write_file: { allowedDecisions: ["edit"] },
      },
    });
    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "x.txt", content: "x" },
          },
        ],
      ],
    });

    const agent = createAgent({
      model,
      checkpointer: new MemorySaver(),
      tools: [writeFileTool],
      middleware: [middleware],
    });
    const config = { configurable: { thread_id: "pa-hitl-disallowed" } };
    await agent.invoke(
      { messages: [new HumanMessage("Write to file")] },
      config
    );

    await expect(() =>
      agent.invoke(
        new Command({
          resume: {
            decisions: [{ type: "approve" }],
          } as HITLResponse,
        }),
        config
      )
    ).rejects.toThrow(
      "Decision type 'approve' is not allowed for tool 'write_file'"
    );
  });
});
