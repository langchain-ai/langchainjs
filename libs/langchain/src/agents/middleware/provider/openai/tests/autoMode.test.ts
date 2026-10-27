import { describe, it, expect, vi } from "vitest";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { openAIAutoModeMiddleware } from "../autoMode.js";
import type { ToolCallRequest } from "../../../types.js";
import { decisions } from "./utils.js";

const request = {
  toolCall: { id: "c", name: "delete", args: { path: "backup" } },
  tool: { name: "delete", description: "Deletes a file" },
  state: { messages: [new HumanMessage("delete backup")] },
  runtime: {},
} as unknown as ToolCallRequest;

describe("openAIAutoModeMiddleware", () => {
  it.each([
    [{ type: "predicate", probability: 0.5 }, "probability: 0.50"],
    [{ type: "refusal" }, "could not be assessed"],
  ])("blocks risky or refused calls (%j)", async (answer, message) => {
    const { model } = decisions([answer]);
    const middleware = openAIAutoModeMiddleware({ model, tools: ["delete"] });
    const handler = vi.fn();
    const result = await middleware.wrapToolCall!(request, handler);
    expect(handler).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(ToolMessage);
    expect((result as ToolMessage).status).toBe("error");
    expect((result as ToolMessage).content).toContain(message);
  });

  it("runs safe calls, skips unlisted tools and sends the call", async () => {
    const { model, fetch, sent } = decisions([
      { type: "predicate", probability: 0.1 },
    ]);
    const middleware = openAIAutoModeMiddleware({ model, tools: ["delete"] });
    const handler = vi
      .fn()
      .mockResolvedValue(
        new ToolMessage({ content: "done", tool_call_id: "c" })
      );
    await middleware.wrapToolCall!(request, handler);
    await middleware.wrapToolCall!(
      { ...request, toolCall: { ...request.toolCall, name: "read" } },
      handler
    );
    expect(handler).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledOnce();
    const { input, questions } = sent();
    expect(questions[0]).toMatchObject({ type: "predicate", name: "is_risky" });
    expect(input[0].content[0]).toEqual({
      type: "input_json",
      data: {
        messages: [{ role: "user", content: "delete backup" }],
        tool_call: { id: "c", name: "delete", args: { path: "backup" } },
        tool_description: "Deletes a file",
      },
    });
  });

  it("propagates failures without running the tool", async () => {
    const { model } = decisions(new Error("unavailable"));
    const middleware = openAIAutoModeMiddleware({ model, tools: ["delete"] });
    const handler = vi.fn();
    await expect(middleware.wrapToolCall!(request, handler)).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("validates options", () => {
    expect(() => openAIAutoModeMiddleware({ model: "m", tools: [] })).toThrow(
      "at least one tool"
    );
  });
});
