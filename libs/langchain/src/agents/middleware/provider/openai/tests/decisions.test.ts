import { describe, it, expect, vi } from "vitest";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { OpenAIDecisions } from "@langchain/openai";
import {
  openAIAutoModeMiddleware,
  openAIModelRouterMiddleware,
} from "../decisions.js";
import type { ToolCallRequest } from "../../../types.js";

function decisions(answers: Record<string, unknown>[] | Error) {
  const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (answers instanceof Error) throw answers;
    const { questions } = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        model: "m",
        answers: answers.map((answer) => ({
          name: questions[0].name,
          ...answer,
        })),
      }),
      { headers: { "content-type": "application/json" } }
    );
  });
  const model = new OpenAIDecisions({
    model: "m",
    apiKey: "test",
    configuration: { fetch, maxRetries: 0 },
  });
  const sent = (call = 0) =>
    JSON.parse(String(fetch.mock.calls[call][1]?.body));
  return { model, fetch, sent };
}

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

describe("openAIModelRouterMiddleware", () => {
  const route = {
    type: "choice",
    choice: "fast",
    confidence: 0.9,
    probabilities: [
      { value: "fast", probability: 0.95 },
      { value: "slow", probability: 0.05 },
    ],
  };

  it("routes once from the latest human message", async () => {
    const { model, fetch, sent } = decisions([route]);
    const fast = { name: "fast" } as never;
    const middleware = openAIModelRouterMiddleware({
      model,
      instructions: "Choose",
      choices: {
        fast: { model: fast, criteria: "Simple" },
        slow: { model: "openai:gpt-6-sol", criteria: "Hard" },
      },
    });
    const before = middleware.beforeAgent as (
      ...args: unknown[]
    ) => Promise<Record<string, unknown>>;
    const state = await before(
      {
        messages: [
          new HumanMessage("first"),
          new HumanMessage("latest"),
          new AIMessage("answer"),
        ],
      },
      {}
    );
    expect(state).toEqual({
      modelRoute: {
        choice: "fast",
        confidence: 0.9,
        probabilities: [
          { value: "fast", probability: 0.95 },
          { value: "slow", probability: 0.05 },
        ],
      },
    });
    expect(sent().input).toEqual([{ role: "user", content: "latest" }]);
    expect(sent().questions[0].choices).toEqual([
      { value: "fast", description: "Simple" },
      { value: "slow", description: "Hard" },
    ]);
    const handler = vi.fn().mockResolvedValue(new AIMessage("ok"));
    await middleware.wrapModelCall!({ state, model: {} } as never, handler);
    await middleware.wrapModelCall!({ state, model: {} } as never, handler);
    expect(handler.mock.calls[1][0].model).toBe(fast);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("keeps the agent model with no human message or a refusal", async () => {
    const { model, fetch } = decisions([{ type: "refusal" }]);
    const middleware = openAIModelRouterMiddleware({
      model,
      instructions: "Choose",
      choices: { fast: { model: "openai:gpt-6-luna", criteria: "Simple" } },
    });
    const before = middleware.beforeAgent as (
      ...args: unknown[]
    ) => Promise<Record<string, unknown>>;
    expect(await before({ messages: [] }, {})).toEqual({ modelRoute: null });
    expect(fetch).not.toHaveBeenCalled();
    expect(await before({ messages: [new HumanMessage("hi")] }, {})).toEqual({
      modelRoute: null,
    });
    const handler = vi.fn();
    const own = {};
    await middleware.wrapModelCall!(
      { state: { modelRoute: null }, model: own } as never,
      handler
    );
    expect(handler.mock.calls[0][0].model).toBe(own);
  });
});
