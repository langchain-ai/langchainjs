import { describe, it, expect, vi } from "vitest";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { OpenAIDecisions, type DecisionResponse } from "@langchain/openai";
import {
  openAIAutoModeMiddleware,
  openAIModelRouterMiddleware,
} from "../decisions.js";
import type { ToolCallRequest } from "../../../types.js";

function response(probability?: number): DecisionResponse {
  return {
    model: "m",
    answers: {},
    predicates:
      probability === undefined
        ? {}
        : { is_risky: { type: "predicate", probability } },
    choices: {},
    scores: {},
    refusals: {},
    usage: {},
    usage_metadata: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    request_id: null,
  };
}
function model(result: DecisionResponse) {
  const decisions = new OpenAIDecisions({ model: "m", apiKey: "test" });
  const invoke = vi.spyOn(decisions, "invoke").mockResolvedValue(result);
  return { decisions, invoke };
}
const request = {
  toolCall: { id: "c", name: "delete", args: { path: "backup" } },
  tool: undefined,
  state: { messages: [new HumanMessage("delete backup")] },
  runtime: {},
} as ToolCallRequest;
describe("OpenAI Decisions middleware", () => {
  it.each([0.5, 0.9, undefined])(
    "blocks risky or refused calls (%s)",
    async (probability) => {
      const { decisions } = model(response(probability));
      const middleware = openAIAutoModeMiddleware({
        model: decisions,
        tools: ["delete"],
      });
      const handler = vi.fn();
      const result = await middleware.wrapToolCall!(request, handler);
      expect(handler).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(ToolMessage);
      expect((result as ToolMessage).status).toBe("error");
    }
  );
  it("executes safe calls and bypasses unlisted tools", async () => {
    const { decisions, invoke } = model(response(0.1));
    const middleware = openAIAutoModeMiddleware({
      model: decisions,
      tools: ["delete"],
    });
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
    expect(invoke).toHaveBeenCalledOnce();
  });
  it("propagates failures without executing", async () => {
    const { decisions, invoke } = model(response(0));
    invoke.mockRejectedValue(new Error("unavailable"));
    const middleware = openAIAutoModeMiddleware({
      model: decisions,
      tools: ["delete"],
    });
    const handler = vi.fn();
    await expect(middleware.wrapToolCall!(request, handler)).rejects.toThrow(
      "unavailable"
    );
    expect(handler).not.toHaveBeenCalled();
  });
  it("retries rejected images once with text placeholders", async () => {
    const { decisions, invoke } = model(response(0.1));
    invoke.mockRejectedValueOnce(
      Object.assign(new Error("image"), { status: 400 })
    );
    const middleware = openAIAutoModeMiddleware({
      model: decisions,
      tools: ["delete"],
    });
    const handler = vi.fn();
    await middleware.wrapToolCall!(
      {
        ...request,
        state: {
          ...request.state,
          messages: [
            new HumanMessage({
              content: [
                { type: "image_url", image_url: "data:image/png;base64,AA==" },
              ],
            }),
          ],
        },
      },
      handler
    );
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(invoke.mock.calls[1][0])).toContain("omitted");
    expect(handler).toHaveBeenCalledOnce();
  });
  it("routes once from the latest human and preserves state", async () => {
    const answer = response();
    answer.choices.model_route = {
      type: "choice",
      choice: "fast",
      probabilities: { fast: 1 },
      confidence: 1,
    };
    const { decisions, invoke } = model(answer);
    const selected = {} as never;
    const middleware = openAIModelRouterMiddleware({
      model: decisions,
      instructions: "Choose",
      choices: { fast: { model: selected, criteria: "Simple" } },
    });
    const before = middleware.beforeAgent;
    if (typeof before !== "function")
      throw new Error("Expected beforeAgent hook");
    const state = await before(
      {
        messages: [
          new HumanMessage("first"),
          new HumanMessage("latest"),
          new AIMessage("answer"),
        ],
      },
      {} as never
    );
    expect(invoke.mock.calls[0][0].input).toMatchObject({ content: "latest" });
    const handler = vi.fn().mockResolvedValue(new AIMessage("ok"));
    await middleware.wrapModelCall!({ state, model: {} } as never, handler);
    expect(handler.mock.calls[0][0].model).toBe(selected);
    expect(invoke).toHaveBeenCalledOnce();
  });
  it("clears prior routes with no human or refusal", async () => {
    const { decisions } = model(response());
    const middleware = openAIModelRouterMiddleware({
      model: decisions,
      instructions: "Choose",
      choices: { fast: { model: "openai:gpt-4o-mini", criteria: "Simple" } },
    });
    const before = middleware.beforeAgent;
    if (typeof before !== "function")
      throw new Error("Expected beforeAgent hook");
    expect(await before({ messages: [] }, {} as never)).toEqual({
      model_route: null,
    });
    expect(
      await before({ messages: [new HumanMessage("hi")] }, {} as never)
    ).toEqual({ model_route: null });
  });
});
