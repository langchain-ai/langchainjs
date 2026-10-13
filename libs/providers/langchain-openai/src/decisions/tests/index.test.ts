import { describe, it, expect, vi } from "vitest";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { OpenAIDecisions } from "../index.js";
import { toDecisionInput } from "../input.js";
import { toQuestion } from "../types.js";

const request = {
  input: "help",
  questions: {
    urgent: { type: "predicate" as const, instructions: "Urgent?" },
  },
};
function model(body: unknown) {
  const fetch = vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        headers: {
          "content-type": "application/json",
          "x-request-id": "req-123",
        },
      })
  );
  return {
    fetch,
    decisions: new OpenAIDecisions({
      model: "decision-model",
      apiKey: "test-key",
      configuration: { fetch, maxRetries: 0 },
    }),
  };
}
describe("OpenAI Decisions", () => {
  it("posts named questions and groups normalized answers", async () => {
    const { fetch, decisions } = model({
      model: "decision-model",
      answers: [
        { name: "urgent", type: "predicate", probability: 0.9 },
        {
          name: "team",
          type: "choice",
          choice: "billing",
          confidence: 0.8,
          probabilities: [{ value: "billing", probability: 0.9 }],
        },
        {
          name: "severity",
          type: "score",
          score: 1.2,
          confidence: 0.7,
          probabilities: [{ value: 1, label: "High", probability: 1 }],
        },
        { name: "unsafe", type: "refusal", reason: "policy" },
        { name: "future", type: "unknown" },
      ],
      usage: { input_tokens: 10, output_tokens: 2 },
    });
    const result = await decisions.invoke(request);
    expect(result.predicates.urgent.probability).toBe(0.9);
    expect(result.choices.team.probabilities).toEqual({ billing: 0.9 });
    expect(result.scores.severity.legend).toEqual({ 1: "High" });
    expect(result.refusals.unsafe.reason).toBe("policy");
    expect(result.answers.future).toBeUndefined();
    expect(result.request_id).toBe("req-123");
    expect(result.usage_metadata.total_tokens).toBe(12);
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
      model: "decision-model",
      input: "help",
      questions: [
        { name: "urgent", type: "predicate", instructions: "Urgent?" },
      ],
    });
  });
  it("supports batch and runnable composition", async () => {
    const { decisions } = model({ model: "m", answers: [] });
    expect((await decisions.batch([request, request])).length).toBe(2);
    expect(await decisions.pipe((result) => result.model).invoke(request)).toBe(
      "m"
    );
  });
  it("traces usage and provider metadata", async () => {
    const { decisions } = model({
      model: "m",
      answers: [],
      usage: { input_tokens: 3 },
    });
    const start = vi.fn();
    const end = vi.fn();
    await decisions.invoke(request, {
      callbacks: [{ handleChatModelStart: start, handleLLMEnd: end }],
    });
    expect(start).toHaveBeenCalledOnce();
    expect(start.mock.calls[0][6]).toMatchObject({
      ls_provider: "openai",
      ls_model_name: "decision-model",
    });
    expect(
      end.mock.calls[0][0].generations[0][0].message.usage_metadata.total_tokens
    ).toBe(3);
  });
  it("reports cancellation without sending a request", async () => {
    const { fetch, decisions } = model({ model: "m", answers: [] });
    const controller = new AbortController();
    controller.abort();
    const error = vi.fn();
    await expect(
      decisions.invoke(request, {
        signal: controller.signal,
        callbacks: [{ handleLLMError: error }],
      })
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });
  it("rejects invalid API answers", async () => {
    const { decisions } = model({
      model: "m",
      answers: [{ name: "urgent", type: "predicate", probability: 2 }],
    });
    await expect(decisions.invoke(request)).rejects.toThrow();
  });
  it("converts choices and score levels", () => {
    expect(
      toQuestion("team", {
        type: "choice",
        instructions: "Team?",
        choices: { a: null, b: "B" },
      })
    ).toMatchObject({
      choices: [{ value: "a" }, { value: "b", description: "B" }],
    });
    expect(
      toQuestion("score", {
        type: "score",
        instructions: "Rate",
        levels: ["Low", { label: "High", description: "Bad" }],
      })
    ).toMatchObject({
      levels: [{ label: "Low" }, { label: "High", description: "Bad" }],
    });
    expect(() =>
      toQuestion("s", { type: "score", instructions: "Rate", levels: ["One"] })
    ).toThrow();
  });
  it("uses native human input and base64 images", () => {
    const input = toDecisionInput(
      new HumanMessage({
        content: [
          { type: "text", text: "see" },
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,AA==" },
          },
        ],
      })
    );
    expect(input).toEqual([
      {
        role: "user",
        content: [
          { type: "input_text", text: "see" },
          { type: "input_image", image_url: "data:image/png;base64,AA==" },
        ],
      },
    ]);
    expect(() =>
      toDecisionInput(
        new HumanMessage({
          content: [
            { type: "image_url", image_url: "https://example.com/image" },
          ],
        })
      )
    ).toThrow();
  });
  it("serializes mixed roles and preserves image positions", () => {
    const input = toDecisionInput({
      messages: [
        new HumanMessage("hi"),
        new AIMessage({
          content: [
            {
              type: "image_url",
              image_url: { url: "data:image/png;base64,AA==" },
            },
          ],
          tool_calls: [{ id: "c", name: "read", args: {} }],
        }),
        new ToolMessage({ content: "ok", tool_call_id: "c" }),
      ],
    });
    expect(input).not.toEqual("hi");
    expect(JSON.stringify(input)).toContain("input_image");
    expect(JSON.stringify(input)).toContain("tool_call_id");
    expect(JSON.stringify(input)).not.toContain("lc-image-");
  });
  it("rejects non-JSON and cycles", () => {
    expect(() => toDecisionInput({ bad: undefined } as never)).toThrow();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => toDecisionInput(cyclic as never)).toThrow();
  });
});
