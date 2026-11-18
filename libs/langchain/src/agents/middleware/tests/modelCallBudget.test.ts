import { describe, it, expect, vi } from "vitest";
import { z } from "zod/v3";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { interrupt, Command } from "@langchain/langgraph";

import { FakeToolCallingChatModel } from "../../tests/utils.js";
import { createAgent, toolStrategy } from "../../index.js";
import { modelCallBudgetMiddleware } from "../modelCallBudget.js";

const call = { id: "call", name: "echo", args: {} };

describe("modelCallBudgetMiddleware", () => {
  it.each([false, true])(
    "finalizes with no tools (structured=%s)",
    async (structured) => {
      const execute = vi.fn(() => "evidence");
      const model = new FakeToolCallingChatModel({
        sleep: 0,
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [call, { ...call, id: "other" }],
          }),
          new AIMessage("Final answer"),
        ],
      });
      const generate = vi.spyOn(model, "_generate");
      const agent = createAgent({
        model,
        tools: [
          tool(execute, { name: "echo", description: "Collect evidence" }),
        ],
        systemPrompt: new SystemMessage({
          content: [{ type: "text", text: "Original instructions" }],
        }),
        middleware: [modelCallBudgetMiddleware({ runLimit: 1 })],
        ...(structured
          ? { responseFormat: toolStrategy(z.object({ answer: z.string() })) }
          : {}),
      });
      const result = await agent.invoke({ messages: ["Investigate"] });
      expect(result.messages.at(-1)?.content).toBe("Final answer");
      expect(result.modelBudgetUsed).toBe(2);
      expect(execute).toHaveBeenCalledTimes(2);
      expect(generate).toHaveBeenCalledTimes(2);
      expect(generate.mock.calls[0][0][0].text).toContain(
        "0/1 working turns used; 1 remaining"
      );
      expect(generate.mock.calls[1][0][0].text).toContain(
        "1/1 working turns used; 0 remaining"
      );
      expect(generate.mock.calls[1][0][0].text).toContain(
        "Original instructions"
      );
      expect(generate.mock.calls[1][1]).toHaveProperty("tools", []);
      expect(result.messages.some((message) => message.type === "system")).toBe(
        false
      );
    }
  );

  it.each([0, 2])(
    "ends early and resets each invocation with budget %s",
    async (runLimit) => {
      const model = new FakeToolCallingChatModel({
        sleep: 0,
        responses: [new AIMessage("Done")],
      });
      const generate = vi.spyOn(model, "_generate");
      const agent = createAgent({
        model,
        middleware: [modelCallBudgetMiddleware({ runLimit })],
        checkpointer: new MemorySaver(),
      });
      for (let i = 0; i < 2; i += 1) {
        const result = await agent.invoke(
          { messages: ["Answer"] },
          { configurable: { thread_id: "budget" } }
        );
        expect(result.modelBudgetUsed).toBe(1);
        expect(generate.mock.calls[i][0][0].text).toContain(
          `0/${runLimit} working turns used`
        );
      }
      expect(generate).toHaveBeenCalledTimes(2);
    }
  );

  it("preserves consumption across checkpoint resume", async () => {
    const model = new FakeToolCallingChatModel({
      sleep: 0,
      responses: [
        new AIMessage({ content: "", tool_calls: [call] }),
        new AIMessage("Done"),
      ],
    });
    const generate = vi.spyOn(model, "_generate");
    const agent = createAgent({
      model,
      tools: [
        tool(
          () => {
            interrupt("Continue?");
            return "evidence";
          },
          {
            name: "echo",
            description: "Collect evidence",
          }
        ),
      ],
      middleware: [modelCallBudgetMiddleware({ runLimit: 1 })],
      checkpointer: new MemorySaver(),
    });
    const config = { configurable: { thread_id: "resume" } };
    const paused = await agent.invoke({ messages: ["Investigate"] }, config);
    expect(paused.modelBudgetUsed).toBe(1);
    const result = await agent.invoke(new Command({ resume: true }), config);
    expect(result.modelBudgetUsed).toBe(2);
    expect(generate.mock.calls[1][0][0].text).toContain(
      "1/1 working turns used; 0 remaining"
    );
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("rejects final tool calls without executing them", async () => {
    const execute = vi.fn(() => "unexpected");
    const agent = createAgent({
      model: new FakeToolCallingChatModel({
        sleep: 0,
        responses: [new AIMessage({ content: "", tool_calls: [call] })],
      }),
      tools: [tool(execute, { name: "echo", description: "Collect evidence" })],
      middleware: [modelCallBudgetMiddleware({ runLimit: 0 })],
    });
    await expect(agent.invoke({ messages: ["Answer"] })).rejects.toThrow(
      "must not contain tool calls"
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, NaN, Infinity])("rejects invalid budget %s", (runLimit) => {
    expect(() => modelCallBudgetMiddleware({ runLimit })).toThrow(
      "nonnegative safe integer"
    );
  });
});
