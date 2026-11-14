import { z } from "zod";
import { describe, it, expect, vi } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { Command } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";

import { createAgent } from "../../index.js";
import {
  perActionHumanInTheLoopMiddleware,
  type HITLResponse,
} from "../index.js";
import { FakeToolCallingModel } from "../../tests/utils.js";

const calculatorFn = vi.fn(
  ({ a, b, operation }: { a: number; b: number; operation: string }) => {
    if (operation === "multiply") {
      return `${a} * ${b} = ${a * b}`;
    }
    return `${a} + ${b} = ${a + b}`;
  }
);

const nameGeneratorFn = vi.fn(() => "Thomas");

const calculator = tool(calculatorFn, {
  name: "calculator",
  description: "Performs arithmetic operations",
  schema: z.object({
    a: z.number(),
    b: z.number(),
    operation: z.enum(["add", "multiply"]),
  }),
});

const nameGenerator = tool(nameGeneratorFn, {
  name: "name_generator",
  description: "Generates a deterministic name",
  schema: z.object({}),
});

describe("perActionHumanInTheLoopMiddleware integration", () => {
  it("should execute approved actions and keep structured output flow when other actions are rejected", async () => {
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
            name: "name_generator",
            args: {},
          },
        ],
        [],
      ],
      structuredResponse: {
        result: 714,
        name: "Thomas",
      },
    });

    const agent = createAgent({
      model,
      middleware: [
        perActionHumanInTheLoopMiddleware({
          interruptOn: {
            calculator: true,
            name_generator: true,
          },
        }),
      ] as const,
      tools: [calculator, nameGenerator],
      responseFormat: z.object({
        result: z.number(),
        name: z.string(),
      }),
      checkpointer: new MemorySaver(),
    });

    const config = {
      configurable: {
        thread_id: "pa-hitl-int-structured",
      },
    };

    const initial = await agent.invoke(
      {
        messages: [new HumanMessage("Calculate 42 * 17 and generate a name.")],
      },
      config
    );
    expect("__interrupt__" in initial).toBe(true);

    const resumed = await agent.invoke(
      new Command({
        resume: {
          decisions: [
            { type: "approve" },
            { type: "reject", message: "Use existing approved values only." },
          ],
        } satisfies HITLResponse,
      }),
      config
    );

    expect(calculatorFn).toHaveBeenCalledTimes(1);
    expect(nameGeneratorFn).not.toHaveBeenCalled();
    expect(resumed.messages.length).toBeGreaterThan(0);
  });

  it("should execute edited actions in mixed decision batches with checkpointer resume", async () => {
    const fileWriterFn = vi.fn(
      ({ filename, content }: { filename: string; content: string }) =>
        `wrote ${content} to ${filename}`
    );
    const fileWriter = tool(fileWriterFn, {
      name: "write_file",
      description: "Writes file content",
      schema: z.object({
        filename: z.string(),
        content: z.string(),
      }),
    });

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            id: "call_1",
            name: "write_file",
            args: { filename: "unsafe.txt", content: "unsafe" },
          },
          {
            id: "call_2",
            name: "name_generator",
            args: {},
          },
        ],
      ],
    });

    const agent = createAgent({
      model,
      middleware: [
        perActionHumanInTheLoopMiddleware({
          interruptOn: {
            write_file: true,
            name_generator: true,
          },
        }),
      ] as const,
      tools: [fileWriter, nameGenerator],
      checkpointer: new MemorySaver(),
    });

    const config = {
      configurable: {
        thread_id: "pa-hitl-int-edit-reject",
      },
    };

    await agent.invoke(
      {
        messages: [new HumanMessage("Write unsafe file and generate a name")],
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
                args: { filename: "safe.txt", content: "safe" },
              },
            },
            {
              type: "reject",
              message: "Do not generate names for this request",
            },
          ],
        } satisfies HITLResponse,
      }),
      config
    );

    expect(fileWriterFn).toHaveBeenCalledTimes(1);
    expect(fileWriterFn).toHaveBeenCalledWith(
      { filename: "safe.txt", content: "safe" },
      expect.anything()
    );
    expect(nameGeneratorFn).not.toHaveBeenCalled();
  });
});
