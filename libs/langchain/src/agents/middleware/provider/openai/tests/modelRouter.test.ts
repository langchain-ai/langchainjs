import { describe, it, expect, vi } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { openAIModelRouterMiddleware } from "../modelRouter.js";
import { decisions } from "./utils.js";

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
